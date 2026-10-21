# Conexão Meta — fluxo técnico completo

Este documento descreve a parte que **fica logada**: como o painel entra na conta
Meta do cliente, descobre as contas de anúncios, mantém esse acesso vivo e o que
fazer quando ele cai.

Ele está escrito em cima do que já existe em `apps/dashboard/src` — cada trecho
diz o que já está no código, o que precisa mudar e o que ainda não existe. Onde
digo "falta", é porque procurei e não achei, não porque presumi.

---

## 1. O que já existe hoje

| Arquivo | O que faz |
| --- | --- |
| `app/api/meta/oauth/route.ts` | Inicia o OAuth. Gera `state` de 32 bytes, guarda em cookie `httpOnly` por 10 min, redireciona para `facebook.com/v20.0/dialog/oauth` com escopo `ads_read,ads_management,business_management`. |
| `app/api/meta/callback/route.ts` | Valida o `state`, troca o `code` por token, busca as contas, criptografa o token e faz `upsert` em `ad_accounts` com `onConflict: "org_id,external_id"`. |
| `lib/meta/token.ts` | `encryptToken` / `decryptToken` via RPC `encrypt_token` / `decrypt_token` no Supabase (pgcrypto, `pgp_sym_encrypt`, AES‑256). Chave em `SUPABASE_ENCRYPTION_KEY`, mínimo 32 caracteres. |
| `lib/meta/org-token.ts` | Pega o token da organização: a linha mais recente de `ad_accounts` com `platform = meta`, `status = active` e token não nulo. Tem cache de 5 min da lista de contas, por organização. |
| `lib/meta/validateToken.ts` | Valida um token chamando `GET /v19.0/me?fields=id,name`. Devolve `{id, name}` ou `null`. |
| `app/api/meta/accounts/route.ts` | Lista as contas salvas, traduzindo `status` textual para um código numérico (`active → 1`, `expired → 3`, `disconnected → 101`). |
| `app/api/meta/disconnect/route.ts` | `DELETE` em `ad_accounts` por `external_id`. |
| `app/api/meta/connect/route.ts` | Legado. Devolve `410` apontando para o fluxo OAuth. |

E o que **não existe** — isso é o centro do trabalho:

- **Nenhuma chamada a `/me/businesses`, `owned_ad_accounts` ou `client_ad_accounts`.**
  O agrupamento por Business Manager que aparece na tela não tem nada por trás.
- **Nenhuma troca de token curto por token longo.** Não há `fb_exchange_token`,
  `grant_type` nem `debug_token` em lugar nenhum do repositório. Hoje o que é
  gravado é o token que o `code` devolveu, e o `token_expires_at` é calculado a
  partir do `expires_in` desse token.
- **Nenhuma tabela de conexão.** Só existem `ad_accounts` e `clients`. Não há onde
  registrar "esta organização conectou tal usuário Meta em tal data".
- **Versões misturadas:** `v19.0` em `validateToken.ts`, `v20.0` no diálogo de OAuth,
  e as duas espalhadas nas rotas de dados.

---

## 2. A decisão que vem antes do código

O token que o painel guarda pode ser de três naturezas, e a escolha muda tudo o que
vem depois. Não dá para adiar.

**Token de usuário curto.** É o que o `code` do OAuth devolve. Dura cerca de uma
hora. Serve para a troca do passo seguinte e para nada mais. Guardar este é o que o
código faz hoje, e é o motivo de a conexão "cair sozinha".

**Token de usuário longo.** Sai da troca `fb_exchange_token`. Dura cerca de 60 dias
e morre antes disso se a pessoa trocar a senha, revogar o app, ou a Meta pedir nova
verificação. É o certo quando **o cliente conecta a própria conta** e aceita
reconectar de vez em quando.

**Token de System User.** Nasce dentro do Business Manager, vinculado a um usuário
de sistema, e **não expira**. É o certo quando **você administra as contas dos
clientes dentro do seu próprio BM** — que é o caso da agência. Não passa por OAuth:
é gerado uma vez no BM e colado numa tela de administração.

A pergunta prática: **os seus clientes vão conectar o BM deles, ou as contas deles
vivem dentro do seu BM?** Se for o primeiro, você precisa de App Review para
`ads_read` e `business_management` e de verificação de negócio, e o token longo
com renovação é o caminho. Se for o segundo, System User resolve e o OAuth vira
conveniência, não dependência.

O desenho abaixo suporta os dois, com uma coluna `token_kind` distinguindo.

---

## 3. Modelo de dados

Hoje o token mora em `ad_accounts`, repetido em cada linha — o `callback` grava o
mesmo `token_encrypted` em todas as contas daquele OAuth. Isso tem três problemas:
o mesmo segredo em N lugares, nenhuma forma de saber que N contas vieram de uma
única conexão, e a revogação vira `UPDATE` em massa.

A conexão precisa de tabela própria.

```sql
-- Uma linha por "vez que alguém ligou uma conta Meta a esta organização".
create table meta_connections (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  connected_by      uuid not null references profiles(id),

  meta_user_id      text not null,          -- /me → id
  meta_user_name    text,                   -- /me → name
  token_kind        text not null           -- 'user_long' | 'system_user'
                    check (token_kind in ('user_long','system_user')),
  token_encrypted   text not null,          -- pgp_sym_encrypt, nunca em claro
  token_expires_at  timestamptz,            -- null quando token_kind = 'system_user'
  scopes            text[] not null default '{}',

  status            text not null default 'active'
                    check (status in ('active','expiring','expired','revoked','error')),
  last_error_code   int,
  last_error_sub    int,
  last_checked_at   timestamptz,
  connected_at      timestamptz not null default now(),

  unique (org_id, meta_user_id)
);

-- Business Managers que esse token enxerga. Serve ao agrupamento da tela.
create table meta_businesses (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references meta_connections(id) on delete cascade,
  org_id         uuid not null references organizations(id) on delete cascade,
  external_id    text not null,             -- business id
  name           text not null,
  unique (connection_id, external_id)
);
```

E `ad_accounts` muda de forma: deixa de carregar o segredo e passa a apontar para a
conexão.

```sql
alter table ad_accounts
  add column connection_id uuid references meta_connections(id) on delete set null,
  add column business_id   uuid references meta_businesses(id) on delete set null,
  add column account_status      int,       -- código cru da Meta, sem tradução
  add column disable_reason      int,
  add column permitted_tasks     text[] default '{}',
  add column access_type         text,      -- 'OWNER' | 'AGENCY'
  add column selected            boolean not null default false,
  add column last_synced_at      timestamptz,
  add column last_sync_error     text;

-- o token sai daqui assim que a migração de dados terminar
-- alter table ad_accounts drop column token_encrypted, drop column token_expires_at;
```

Três colunas merecem justificativa.

`timezone` **já existe e precisa ser respeitada**: o dia de um relatório é o dia do
fuso da conta de anúncios, não o do servidor nem o do navegador. Sem isso, "hoje"
no painel e "hoje" no Gerenciador discordam e todo o resto perde crédito.

`selected` separa **o que o token enxerga** do **que o cliente quis trazer**. Um
token pode ver quarenta contas; o cliente marca três. Sem essa coluna, ou você
sincroniza quarenta, ou some com trinta e sete a cada nova descoberta.

`account_status` guardado **cru**. A tradução para texto que `accounts/route.ts` faz
hoje (`active/expired/disconnected`) perde informação: a Meta distingue conta
desativada por ela, conta em atraso de pagamento, conta em análise de risco e conta
fechada, e cada uma pede uma frase diferente na tela.

As políticas de RLS seguem o padrão do resto do projeto: tudo filtrado por `org_id`,
e `meta_connections` sem `SELECT` de `token_encrypted` para o cliente — o token só
é lido por função `SECURITY DEFINER` chamada do servidor.

---

## 4. Endpoints

### Rotas internas

| Rota | Método | O que faz |
| --- | --- | --- |
| `/api/meta/oauth` | GET | Já existe. Redireciona para o diálogo da Meta com `state` em cookie. |
| `/api/meta/callback` | GET | Já existe, precisa mudar (seção 5). Troca `code` por token **longo**, grava em `meta_connections`, descobre BMs e contas, e **não** marca nada como `selected`. |
| `/api/meta/connections` | GET | Nova. Lista as conexões da organização com estado, dono Meta e data de expiração. É o que alimenta o cabeçalho da tela. |
| `/api/meta/connections/[id]/check` | POST | Nova. Teste ao vivo: chama `debug_token` e `/me/adaccounts` — **os mesmos endpoints que a sincronização usa**. Um teste que chama só `/me` mente: `/me` responde com um token que não tem `ads_read`. |
| `/api/meta/connections/[id]/refresh` | POST | Nova. Redescobre BMs e contas e atualiza `meta_businesses` e `ad_accounts` por `upsert`. |
| `/api/meta/accounts` | GET | Existe. Passa a devolver as contas agrupadas por BM, com `account_status` cru, `selected` e `last_synced_at`. |
| `/api/meta/accounts/select` | POST | Nova. Recebe a lista de `external_id` marcados e escreve `selected`. |
| `/api/meta/disconnect` | DELETE | Existe. Passa a receber `connectionId` e apagar a conexão; as contas ficam, com `connection_id` nulo e `status = 'disconnected'`, para não perder histórico. |
| `/api/cron/meta-sync` | GET | Existe. Passa a ignorar contas com `selected = false` e conexões fora de `active`. |

### Endpoints da Graph API

Fixe **uma** versão numa constante (`lib/meta/version.ts`) e use em todo lugar. Hoje
há `v19.0` e `v20.0` no mesmo repositório, o que significa que um dia uma delas sai
do ar e só metade do painel quebra — que é pior do que quebrar inteiro.

```
# troca do code pelo token curto (já existe em client.ts)
GET /{v}/oauth/access_token
    ?client_id={app}&client_secret={secret}
    &redirect_uri={uri}&code={code}

# troca do curto pelo longo — FALTA
GET /{v}/oauth/access_token
    ?grant_type=fb_exchange_token
    &client_id={app}&client_secret={secret}
    &fb_exchange_token={token_curto}

# saúde do token: validade, expiração real e escopos concedidos — FALTA
GET /{v}/debug_token
    ?input_token={token}&access_token={app_id}|{app_secret}

# quem é o dono da conexão
GET /{v}/me?fields=id,name

# os Business Managers — FALTA
GET /{v}/me/businesses?fields=id,name

# contas dentro de cada BM — FALTA
GET /{v}/{business-id}/owned_ad_accounts
    ?fields=id,account_id,name,currency,timezone_name,account_status,disable_reason
GET /{v}/{business-id}/client_ad_accounts
    ?fields=id,account_id,name,currency,timezone_name,account_status,disable_reason

# rede de segurança: contas que o usuário vê fora de qualquer BM (já existe)
GET /{v}/me/adaccounts
    ?fields=id,account_id,name,currency,timezone_name,account_status,disable_reason,business
```

Duas observações de campo. Os nomes exatos dos campos de permissão por conta
(`permitted_tasks`, `access_type`) mudaram de lugar entre versões da Graph API —
confirme contra a referência da versão que você fixar antes de depender deles; se
não vierem, trate `permitted_tasks` como vazio e deixe a Autonomia do Agente
desligada para aquela conta, em vez de assumir permissão. E **pagine tudo**: as
coleções vêm com `paging.next`, e uma agência com muitas contas não cabe na
primeira página.

---

## 5. O fluxo, passo a passo

### 5.1 Conectar

1. O usuário clica em "Vincular conta Meta Ads". O navegador vai para
   `/api/meta/oauth`, que já grava o `state` e redireciona.
2. A Meta devolve em `/api/meta/callback` com `code` e `state`.
3. O callback compara o `state` com o cookie. Diferente ou ausente → aborta.
4. Troca o `code` pelo token curto. **Passo novo:** troca imediatamente o curto pelo
   longo com `fb_exchange_token`, e é o longo que é criptografado e gravado. O curto
   não é persistido em lugar nenhum, nem em log.
5. Chama `debug_token` no token longo para ler `expires_at` **medido** e a lista de
   escopos concedidos. Não calcule a expiração a partir de `expires_in` da resposta
   da troca — o usuário pode ter desmarcado permissões na tela da Meta, e o
   `debug_token` é onde isso aparece.
6. Se `ads_read` não estiver entre os escopos, a conexão nasce em `error` com uma
   frase explícita, e não em `active`. Conectar sem `ads_read` é conectar em nada.
7. Grava `meta_connections`, depois descobre BMs e contas (5.2).
8. Redireciona para `/settings/meta?connected=true`.

### 5.2 Descobrir contas

Para cada BM em `/me/businesses`, busca `owned_ad_accounts` e `client_ad_accounts`.
Depois busca `/me/adaccounts` e adiciona as que não apareceram em BM nenhum — conta
pessoal existe e o cliente não entende por que ela sumiu.

Então **`upsert` por `(org_id, external_id)`, nunca `delete` + `insert`.** É a regra
por trás da frase que está na tela: *"Novas contas são adicionadas sem remover
conexões atuais."* Apagar e reinserir zera `selected`, zera `last_synced_at` e
quebra qualquer chave estrangeira que aponte para a linha.

Uma conta que **sumiu** da resposta não é apagada: recebe `status = 'sem_acesso'` e
continua na tela, com a frase dizendo desde quando não é mais vista. O cliente
precisa saber que perdeu acesso; uma linha que desaparece sozinha é indistinguível
de um bug.

### 5.3 Máquina de estados

A conexão tem cinco estados. A conta de anúncios tem os dela, separados — e esta
separação é o ponto importante: **"Válida" hoje é uma palavra só para três
situações diferentes.**

```
                    ┌──────────┐
      OAuth ok ────▶│  active  │◀──── refresh ok
                    └────┬─────┘
                         │ faltam < 7 dias para expirar
                         ▼
                   ┌───────────┐
                   │ expiring  │──── usuário reconecta ──▶ active
                   └────┬──────┘
                        │ passou da data
                        ▼
                   ┌──────────┐
                   │ expired  │──── usuário reconecta ──▶ active
                   └──────────┘

      erro 190 subcódigo 458/460/463/467, ou debug_token is_valid=false
                         │
                         ▼
                   ┌──────────┐
                   │ revoked  │──── só reconexão manual
                   └──────────┘

      erro de rede, 500 da Meta, 2 (service unavailable)
                         │
                         ▼
                   ┌──────────┐
                   │  error   │──── volta sozinho na próxima checagem
                   └──────────┘
```

`token_kind = 'system_user'` nunca entra em `expiring` nem `expired`: não tem data.
Só sai de `active` por `revoked` (alguém apagou o usuário de sistema no BM) ou por
`error`.

Do lado da conta de anúncios, o estado vem de `account_status` da Meta, guardado
cru e traduzido só na hora de escrever a frase:

| `account_status` | Na tela | Frase |
| --- | --- | --- |
| 1 | Ativa | — |
| 2 | Desativada pela Meta | "A Meta desativou esta conta. Resolva no Gerenciador." |
| 3 | Pagamento pendente | "Há fatura em aberto. A entrega para até o acerto." |
| 7 | Em análise | "A Meta está revisando esta conta." |
| 9 | Período de carência | "Pagamento atrasado, ainda entregando." |
| 100, 101 | Fechada | "Conta fechada. Fica aqui pelo histórico." |

E a combinação que a tela precisa mostrar explicitamente, porque é a que mais
confunde: **token bom + conta desativada pela Meta**. O cartão não pode dizer
"Válida" e não trazer dado. Diz "Conexão em ordem · conta desativada pela Meta",
com o próximo passo.

### 5.4 Sincronizar

A sincronização só olha contas com `selected = true` cuja conexão está `active` ou
`expiring`. Para cada uma, decifra o token da conexão — não da conta — e chama
`insights`. Grava `last_synced_at` em sucesso e `last_sync_error` em falha, e
**nunca apaga o dado anterior**: dado velho com hora visível é melhor do que tabela
vazia, e é o que a tela de Performance já promete no aviso de limite.

---

## 6. Renovação do token

Não existe "refresh token" na Meta. O que existe é: trocar um token longo ainda
válido por outro longo, com a mesma chamada `fb_exchange_token`. Isso **estende**,
não renova indefinidamente — se o usuário trocou a senha ou revogou o app, a troca
falha e só a reconexão manual resolve.

O cron diário faz, para cada conexão com `token_kind = 'user_long'`:

1. `debug_token`. Se `is_valid = false` → `revoked`, e para por aí.
2. Lê `expires_at`. Faltam mais de 14 dias → nada a fazer, grava `last_checked_at`.
3. Faltam entre 7 e 14 dias → tenta `fb_exchange_token`. Sucesso: grava o token novo
   e a nova data. Falha: mantém o token atual e marca `expiring`.
4. Faltam menos de 7 dias → `expiring`, e avisa o usuário: faixa no topo da tela de
   integrações com o número de dias e um botão "Reconectar agora". Se houver
   WhatsApp ligado, uma mensagem também — perder a sincronização por não ter visto
   um aviso dentro do painel é a falha mais boba possível.
5. Passou da data → `expired`. A sincronização para. Os dados já coletados ficam.

Uma trava: a extensão só é tentada uma vez por dia por conexão. Repetir uma troca
que está falhando é a receita para o app ser limitado pela Meta.

---

## 7. O que fazer em cada falha

A regra geral, que vale para todas as linhas abaixo: **erro vira frase com hora e
próximo passo, nunca tela vazia e nunca um código na cara do usuário.** O código vai
para o log e para um `title` no elemento, não para o parágrafo.

### No OAuth

| Situação | Como chega | O que fazer |
| --- | --- | --- |
| Usuário cancelou | `?error=access_denied` | Volta para `/settings/meta` com "Você cancelou a conexão. Nada foi alterado." Sem alarme: não é erro. |
| `state` não bate | Cookie ausente ou diferente | Aborta e recomeça o fluxo. Não tente "consertar": estado que não bate é o cenário de CSRF, e o certo é jogar fora. Frase: "A conexão expirou por segurança. Tente de novo." |
| Cookie expirou (>10 min) | `state` ausente | Mesma coisa, frase diferente: "Você demorou mais de dez minutos. Comece de novo." |
| Usuário desmarcou permissões | `debug_token` sem `ads_read` | Conexão em `error`. Frase nomeando o que falta: "Faltou permitir a leitura de anúncios. Reconecte e mantenha essa opção marcada." |
| Token sem BM nenhum | `/me/businesses` vazio e `/me/adaccounts` vazio | Não grave conexão morta. Frase: "Esse usuário Meta não tem conta de anúncios. Entre com a conta que administra os anúncios." |

### Na Graph API

| Código | Significa | O que fazer |
| --- | --- | --- |
| 190, sub 463 | Token expirou | Conexão → `expired`. Pede reconexão. |
| 190, sub 460 | Senha trocada | Conexão → `revoked`. Frase explicando que trocar a senha derruba o acesso. |
| 190, sub 458 | App removido pelo usuário | `revoked`. |
| 190, sub 467 | Token inválido | `revoked`. |
| 200 / 272 / 294 | Falta permissão para aquele recurso | **Não** derruba a conexão: marca a **conta** com "Sem permissão nesta conta" e segue com as outras. Uma conta sem acesso não pode parar as outras trinta. |
| 4 | Limite do app | Para as chamadas, espera com recuo exponencial, mostra o aviso de limite com a hora do último dado bom. |
| 17 | Limite do usuário | Igual ao 4. É o que a tela de Performance já prevê. |
| 613 | Limite do recurso | Igual, por conta: reduz o lote e tenta mais tarde. |
| 80000‑80004 | Limite por caso de uso | Leia o cabeçalho `X-Business-Use-Case-Usage` e respeite `estimated_time_to_regain_access`. Não adivinhe a espera. |
| 2 | Meta fora do ar | Conexão → `error`, tenta de novo na próxima janela. Não peça reconexão: não é culpa do usuário e reconectar não resolve. |
| 100 | Parâmetro inválido | É bug nosso. Loga com o parâmetro, não mostra ao usuário além de "Não conseguimos ler esta conta agora." |
| 2635 | Versão descontinuada | Alerta de operação, não de usuário. É o motivo de fixar a versão num lugar só. |

### No banco

| Situação | O que fazer |
| --- | --- |
| `SUPABASE_ENCRYPTION_KEY` ausente ou curta | `lib/meta/token.ts` já lança. A rota tem que transformar isso em 500 com "Integração indisponível. Avise o suporte." — e **nunca** seguir gravando o token em claro. |
| `decryptToken` falha | Chave trocada ou dado corrompido. Conexão → `error` com "Precisamos que você reconecte esta conta." `org-token.ts` hoje engole a exceção e devolve `null`; isso precisa virar estado visível, senão a conta some da tela sem explicação. |
| `upsert` falha | Não redirecione com `connected=true`. É o que o callback faz hoje em outros caminhos e está certo: `?error=save_failed`. |

### O que nunca acontece

O token não chega ao cliente, em nenhuma forma: nem no payload, nem em URL, nem em
log, nem em mensagem de erro. O que a tela recebe é `meta_user_name`, o estado, a
data de expiração e as contas. Se um dia um `console.log(token)` entrar num
`route.ts`, isso é incidente de segurança, não bug de log — o token dá acesso de
escrita às campanhas do cliente.

---

## 8. Ordem de implementação

1. Fixar a versão da Graph API numa constante e trocar `v19.0`/`v20.0` por ela.
2. `fb_exchange_token` no callback + `debug_token` para ler validade e escopos.
   Isto sozinho já resolve a maior parte das quedas de conexão.
3. Migração: `meta_connections`, `meta_businesses`, colunas novas em `ad_accounts`,
   backfill a partir das linhas atuais, RLS.
4. Descoberta por BM (`/me/businesses` + `owned_` e `client_ad_accounts`), com
   paginação e `upsert`.
5. Tela: agrupamento por BM, seleção de contas, os três estados separados no cartão.
6. Cron de saúde do token com a escada de 14 / 7 / 0 dias e o aviso ao usuário.
7. Mapa de erros da seção 7 num único lugar (`lib/meta/errors.ts`), usado pelo sync,
   pelo teste ao vivo e pelas rotas de dados — para a mesma falha dar a mesma frase
   em todo o painel.

---

*Gerado a partir da leitura de `apps/dashboard/src/lib/meta/*` e
`apps/dashboard/src/app/api/meta/*` em 25/09/2026. Os campos e códigos da Graph API
devem ser conferidos contra a referência da versão que for fixada no passo 1.*
