# Central de Histórico e Prestação de Contas por Cliente

Status: **v2 — APROVADA com condições na revisão multiagente** (aguarda aprovação da migration) · 21/10/2026
Escopo: aba **Histórico** e aba **Prestação de Contas** no Cliente 360° (`/clients/[id]`), com relatórios por período.

---

## 1. Diagnóstico do que já existe (verificado no código e na API em 21/10/2026)

| Área | Estado atual | Consequência |
|---|---|---|
| Auditoria | Não existe tabela de auditoria/atividade. | Tudo é novo; nada a migrar. |
| Ações do sistema na Meta | Só `POST /api/meta/campanha`: pausar/ativar e `daily_budget` de campanha e conjunto. Não grava histórico — apenas atualiza `campaigns.status` em segundo plano. | Capturar aqui o "antes/depois" e o resultado (sucesso/falha). |
| Outras ações internas | Vínculo de contas a clientes (`/api/clients/[id]/accounts`), escolher/remover contas do painel, conexão Meta (callback/disconnect), clientes (criar/editar/arquivar), alertas (resolver), relatórios (gerar/enviar), WhatsApp. | Candidatas a registro automático (só as relevantes ao cliente). |
| Rastreamento | `tracking_events` recebe eventos do site (pixel próprio + CAPI). Não há tela de "configurar Pixel". | Atividade de rastreamento entra como **manual** ou por eventos futuros. |
| Meta — permissões | Token da organização tem `ads_read`, `ads_management`, `business_management`, `read_insights`. | Suficiente para `act_{id}/activities`. |
| Meta — `act_{id}/activities` | **Testado (somente leitura)** em 3 contas ligadas: 88, 1000+ e 6 eventos em 14 dias. Campos vêm preenchidos: `event_type`, `translated_event_type` (pt-BR), `event_time` (UTC), `date_time_in_timezone`, `actor_name`, `application_name` (ex.: "Power Editor"), `object_type/id/name`, `extra_data` (antes/depois). | A Meta é a **principal fonte** do trabalho feito no Gerenciador. |
| Ator | Dois tipos observados: humano (ex.: nome do gestor via "Power Editor") e **"Meta"** (ações automáticas: revisão de anúncio, cobranças, públicos automáticos). | Separar trabalho do gestor de automações da plataforma. |
| Volume | Conta CA01 teve 1000+ eventos em 14 dias, ~66% `update_ad_run_status` (aprovação de anúncio pela Meta). | Precisa classificar ruído e paginar. |
| Níveis no banco | `campaigns` (nível campanha) e `daily_metrics` por campanha. Não há tabelas de conjunto/anúncio. | Nome da campanha de eventos de conjunto/anúncio precisa de resolução (ver 2.4). |
| Fuso | `ad_accounts.timezone` existe; `profiles.timezone` existe. | Guardar UTC, exibir no fuso do usuário (padrão America/Sao_Paulo). |
| Relatórios | `reports`/`report_runs`: relatórios de **métricas** por template, agendados, com envio WhatsApp. | Reaproveitar envio e motor de métricas; o relatório de prestação de contas é novo (snapshot de atividades). |
| PDF | Nenhuma biblioteca de PDF. | Ver decisão D7. |
| IA | Sem SDK e sem chave de IA configurada. | Ver decisão D9. |

### 1.1 O que a Meta realmente expõe — catálogo de 30 dias, 8 contas do painel (somente leitura, 21/10/2026)

Contas: 212, 53, 236, **4000+** (paginação truncada em 40×100), 24, 54, 66 e **0** eventos (Go English — conta sem atividade no período).

| `event_type` | Título pt-BR (vem pronto) | Volume | Quem | O que traz no `extra_data` | Uso proposto |
|---|---|---|---|---|---|
| `update_ad_run_status` | Status do anúncio atualizado | 2420 | 1321 pessoa · 1099 Meta | status antigo/novo (texto + código) | Decisão humana só quando a transição é entre estados de veiculação (Ativo↔Inativo). Transições de revisão ("Processo pendente", "Análise pendente") = **efeito colateral** → `platform` |
| `first_delivery_event` | Anúncio exibido | 577 | só Meta | — | `platform` |
| `create_ad` | Anúncio criado | 350 | pessoa | id do conjunto | criativo |
| `create_audience` | Público personalizado criado | 303 | 57 pessoa · 246 Meta | nome do público (Meta cria `asa_auto_custom_audience`) | público; Meta = `platform` |
| `update_ad_set_run_status` / `update_campaign_run_status` | Status do conjunto / da campanha atualizado | 261 / 56 | pessoa | status antigo/novo | status |
| `update_ad_set_target_spec` / `update_ad_targets_spec` | Direcionamento atualizado | 145 / 3 | pessoa | lista legível antes/depois (públicos, localização…) | público |
| `update_ad_run_status_to_be_set_after_review` | Status após análise | 134 | pessoa | antigo/novo | status |
| `share_audience` | Custom audience shared | 74 | pessoa | — | público (título vem em inglês) |
| `update_ad_set_budget` / `update_campaign_budget` | Orçamento atualizado | 62 / 17 | pessoa | valor em **centavos** + "Por dia"/vitalício | orçamento |
| `ad_account_billing_charge`, `_refund`, `funding_event_successful`, `ad_account_update_status`, limites de gasto | Conta cobrada etc. | 49+ | só Meta | valores financeiros | `billing` (oculto por padrão, nunca no relatório do cliente sem opção explícita) |
| `update_ad_set_optimization_goal`, `update_ad_set_bid_strategy` | Meta de desempenho / estratégia de lance | 26 / 26 | pessoa | antigo/novo | lance/otimização |
| `create_ad_set`, `create_campaign_group` | Conjunto / campanha criada | 26 / 13 | pessoa | orçamento inicial | estrutura |
| `update_ad_set_duration` | Programação atualizada | 15 | pessoa | datas **em texto localizado** ("set 30, 2026, 12:22 da tarde/noite") | programação (exibir texto como veio) |
| `update_ad_creative`, `add_images`, `edit_images` | Anúncio atualizado / imagem adicionada/editada | 7 / 10 / 10 | pessoa | URLs de imagem **assinadas da CDN** (expiram) | criativo; não depender da URL no relatório |
| `update_ad_set_name`, `delete_audience`, agendamento de orçamento | Nome alterado etc. | ≤ 14 | pessoa | antigo/novo | estrutura/público |

Aplicativos de origem vistos: "Power Editor" (Gerenciador), "Ads Manager App for iOS", **"ANTIGRAVITY-GESTOR DE TRAFEGO"** e **"VAC - ENVIO"** (apps que alteram pela API). O app é guardado e exibido como "via …".
**"ANTIGRAVITY-GESTOR DE TRAFEGO" é o app Meta do próprio Start Metric** (id do `META_APP_ID`, conferido na Graph API). Evento Meta com esse `application_id` passou pelas credenciais do painel ou de outra ferramenta que usa o mesmo app — é a chave da reconciliação (2.3, regra 4).

**Não exposto ou não confiável pela API:** texto/copy do anúncio e conteúdo do criativo de forma estruturada (só URLs temporárias); motivo da alteração; eventos anteriores à janela de retenção da Meta; ligação automática do nome da pessoa com um usuário do painel.

### Nomenclatura legada da Meta (armadilha confirmada)
`object_type` na API usa nomes antigos: `CAMPAIGN_GROUP` = **campanha**, `CAMPAIGN` = **conjunto de anúncios**, `ADGROUP` = **anúncio**, `ACCOUNT` = conta. O `extra_data.campaign_id` de um evento de anúncio é o **id do conjunto**. O normalizador traduz isso; a UI nunca mostra os nomes crus.

### 1.2 Verificações extras feitas após a revisão (somente leitura, 21/10/2026)
- **Ordem:** a API devolve do **mais novo para o mais antigo**.
- **Locale:** muda os textos do `extra_data` ("Ativa" × "Active"). Os **códigos numéricos** (`run_status`) não mudam.
- **Instabilidade:** duas buscas seguidas, mesmo locale, devolvem `extra_data` diferente para `add_images`, `edit_images` e `update_ad_set_target_spec` (URLs assinadas e ordem de listas).
- **Colisão:** existem eventos legítimos com mesmo `event_time` + `event_type` + `object_id` (3 casos numa conta).
- **IDs de 64 bits** chegam como número JSON (> 2^53). `JSON.parse` com `context.source` (Node 26) preserva como texto — verificado.
- **Vínculo conta→cliente** não tem histórico de datas (só `ad_accounts.client_id` atual).
- **Sessão do painel** (`getDashboardSession`) usa **service role** com o cookie do painel: a RLS **não** protege essas rotas; o `orgId` vem de um fallback. *(Pré-existente — ver §6.)*
- **`POST /api/meta/campanha` com conjunto** devolve 404 hoje (busca o id só em `campaigns`). Não lê o valor anterior.

---

## 2. Proposta (v2)

### 2.1 Fonte única de eventos
Tabela central `activity_events`; Histórico, Prestação de Contas, relatórios e resumo leem só dela.

| Origem | Rótulo na tela (texto + ícone, nunca só cor) | Quem grava |
|---|---|---|
| `meta` | **Registrado na Meta** (via Gerenciador / app iOS / API) | sincronização de `act_{id}/activities` |
| `system` | **Feito pelo painel** | rota da API, após o resultado |
| `manual` | **Informado pelo gestor** | formulário "Registrar atividade" |
| `detected` | *fora do MVP* (D5) | — |

Legenda das origens no rodapé de toda tela e no relatório.

### 2.2 Modelo de dados (exige aprovação de migration)

**`activity_events`** — colunas de conteúdo **imutáveis**:
`id`, `org_id`, `ad_account_id`, `source`, `source_app`, `object_level` (`account|campaign|ad_set|ad|audience|creative_library|tracking|client|report|integration|other`), `object_external_id` (texto), `object_name`, `campaign_external_id`, `ad_set_external_id`, `event_type` (cru), `action` (normalizada), `category`, `occurred_at` (UTC), `recorded_at`, `actor_kind` (`person|platform|integration|system_user|unknown`), `actor_name`, `actor_user_id`, `status` (`succeeded|failed|unknown`), `before`, `after` (jsonb **normalizado**, ids como texto, valores em unidade legível + moeda), `counts_as_work` (bool calculado na ingestão), `work_group_key` (agrupa cascatas), `reconciled_with` (uuid), `dedupe_key`, `raw` (jsonb **saneado**: sem URLs assinadas; só para eventos não-plataforma), `error_message`, `created_by`.

Colunas **mutáveis, lista fechada**, toda mudança gravada em `activity_event_revisions` (quem, quando, antes, depois, motivo) por gatilho:
- `client_id` + `attribution` (`by_assignment|assumed|manual_override`) — só pela RPC `reassign_activity_events(org, ids, client, motivo)`;
- `visibility` (`internal|client`);
- `voided_at`, `voided_by`, `void_reason` — anulação por RPC, **qualquer origem**, motivo obrigatório; nunca apaga;
- `campaign_name` — só de NULL para valor, uma vez;
- edição de evento `manual` pelo autor por **15 min** após criar.
Gatilhos BEFORE UPDATE (lista fechada), BEFORE DELETE e BEFORE TRUNCATE bloqueiam o resto **inclusive para service role**. FKs para `clients`/`ad_accounts` com `ON DELETE SET NULL` (arquivar/excluir cliente não apaga histórico).

Índices: único (`org_id`, `dedupe_key`); parcial (`org_id`, `client_id`, `occurred_at desc`) `WHERE voided_at IS NULL AND counts_as_work`; (`org_id`, `client_id`, `occurred_at desc`); (`org_id`, `ad_account_id`, `occurred_at desc`); (`org_id`, `campaign_external_id`, `occurred_at desc`).

**`ad_account_client_assignments`** — `ad_account_id`, `client_id`, `valid_from`, `valid_to`, preenchida por gatilho em `ad_accounts.client_id` (carga inicial: vínculo atual com `valid_from = null` = "desde sempre, presumido").

**`activity_sync_coverage`** — por conta e **dia** (no fuso da conta): `ad_account_id`, `day`, `status` (`complete|partial|failed`), `events`, `fetched_at`, `closed` (dia só fecha 48 h depois). Lacunas = dias sem `complete`.

**`activity_sync_runs`** — execução: `trigger`, `started_at`, `finished_at`, `status` (`running|succeeded|partial|failed|stale`), contadores, `error_code`, `error_message` (sem token/URL). Índice único parcial `(ad_account_id) WHERE status='running'` = **trava por conta**; run `running` há mais de 3 min vira `stale`.

**`client_reports`** — `id`, `org_id`, `client_id`, `period_start`, `period_end`, `timezone`, `params`, `status` (`draft|final`), `summary_text`, `manager_notes`, `next_steps`, `coverage` (lacunas do período), `snapshot` (só no **final**; só campos exibíveis, sem `raw`, sem URLs, sem nome de ator na versão cliente; até 500 itens + totais por categoria), `created_by`, `created_at`, `finalized_at`. Gatilho: `final` é imutável.

Estimativa de volume (para o dono do banco): conta pesada ≈ 4.000 eventos/mês; ~60 % plataforma gravados **sem `raw`** (~0,4 KB); demais ~1,5 KB → ~4 MB/mês por conta pesada; ~1 MB/mês por conta típica. 8 contas ≈ 15 MB/mês.

### 2.3 Regras de integridade (v2)
1. **Dedupe estável:** `dedupe_key = meta:{act}:{event_time}:{event_type}:{object_id}:{assinatura}:{ordinal}`. `assinatura` = hash canônico só de campos **estáveis** (códigos numéricos, valores de orçamento, ids como texto, nomes antes/depois); **exclui** URLs, listas de direcionamento e textos traduzidos. `ordinal` = posição entre eventos com a mesma chave no mesmo segundo (eles sempre vêm na mesma janela diária). Chamadas sempre com `locale=pt_BR`. Teste automatizado com payloads reais (buscas repetidas = zero novas linhas).
2. **IDs** sempre como texto (parse com `context.source`).
3. **Cliente pelo momento da ocorrência:** `client_id` vem de `ad_account_client_assignments` válido em `occurred_at`. Evento antes do primeiro vínculo conhecido → `attribution = assumed` (selo "atribuição presumida" no Histórico; fora do relatório do cliente até o gestor confirmar ou o período ser posterior ao vínculo). Reatribuição posterior não move eventos passados. Correção manual: RPC `reassign_activity_events` com motivo (registrada em revisões).
4. **Reconciliação sistema × Meta:** só casa se `application_id` = app do Start Metric **e** mesmo objeto **e** mesmo campo **e** mesmo valor novo **e** ±15 min. O evento Meta é **inserido** (idempotente) com `reconciled_with` e `counts_as_work = false` — sem UPDATE. Se o evento do sistema estava `unknown` (timeout), o evento Meta casado é a prova e conta como trabalho.
5. **Pedido ≠ concluído:** a rota grava **uma** linha após a resposta: `succeeded`, `failed` (erro da Meta) ou `unknown` (timeout/rede). Só `succeeded` e eventos Meta contam. Gravação **aguardada** (não `setImmediate`); falha de gravação é logada como erro e não derruba a operação.
6. **O que conta como trabalho** (`counts_as_work`): ator humano ou app **e** ação de decisão. Não contam: ator "Meta"; `first_delivery_event`; cobranças/saldo/limites; transições de revisão (códigos de `run_status` de análise/processamento: 9, 17 e equivalentes, mapeados por código); eventos reconciliados; anulados. Tabela de classificação versionada no código, com teste por tipo do catálogo.
7. **Trabalho agrupado:** cartões e relatório contam **itens de trabalho**, não linhas: mesmo ator + mesma ação + mesma campanha em janela de 30 min = 1 item ("Criou 12 anúncios na campanha X"). A lista mostra o grupo expansível. Nenhum cartão sugere que mais é melhor.
8. **App compartilhado:** evento Meta via app do Start Metric sem par no sistema → `actor_kind = integration`, rótulo "Feito via integração (app Start Metric)"; o nome mostrado é o dono do token, com a ressalva "conta conectada por".
9. **Plataforma ≠ trabalho, mas visível:** cobranças, saldo, status da conta e limite de gasto aparecem num bloco **Avisos da plataforma** (gestor) e só entram no relatório do cliente se marcado.

### 2.4 Sincronização Meta (v2)
- **Janelas diárias** (`since`/`until` de 1 dia no fuso da conta), cada uma paginada até o fim e gravada **por página** (`insert … on conflict do nothing` em lote) com cobertura atualizada.
- **Incremental:** a cada execução, reprocessa os **últimos 2 dias** (eventos atrasados); dia fecha após 48 h.
- **Carga inicial:** 30 dias, do mais recente para o mais antigo, por dias pendentes na cobertura; **no máximo 2 contas novas por execução**.
- **Orçamento:** ≤ 45 s e `maxDuration`; ≤ 8 páginas por conta e ≤ 60 chamadas por execução; o que sobrar continua na próxima.
- **Limites da Meta:** reconhecer 4, 17, 32, 613 e 80000–80014; ler `X-Business-Use-Case-Usage`; ao limitar, para a conta e respeita `estimated_time_to_regain_access`. A sync de **métricas** tem prioridade.
- **Agendamento:** pg_cron de hora em hora no minuto **:15** (não coincide com `meta-sync` em :00/:30). Rota sem `GET`, segredo comparado em tempo constante.
- **Botão Atualizar** (cliente): rota autenticada; usa a trava por conta; limite **persistido** (1 execução manual por conta a cada 5 min, via `activity_sync_runs`); devolve "continua em segundo plano" se não terminar.
- **Nome da campanha** de eventos de conjunto/anúncio: primeiro pelo próprio histórico (eventos de criação/nome), depois em lote via Graph com teto por execução; sem nome → mostra id e completa depois (NULL→valor).
- **Segurança:** token nunca em banco/log; cursor guardado como dia, nunca a URL `paging.next`.

### 2.5 Captura interna (v2)
`recordActivity()` aguardado, sempre com `org_id` da sessão/conta e `client_id` validado:
- Campanha/conjunto (status, orçamento): **lê o valor anterior** antes de alterar (1 GET), grava depois com `succeeded|failed|unknown`. Corrige o 404 de conjunto (resolver conjunto via Graph com o token da conta do objeto).
- Vínculo/desvínculo de conta a cliente, conta no painel, conexão/reconexão Meta, cliente criado/editado/arquivado, relatório gerado/finalizado/enviado, alerta resolvido.
- Fora: layout de cartões, preferências.

### 2.6 Interface (v2)
Cliente 360°: abas **Visão geral** · **Histórico** · **Prestação de contas**.
- Cada aba tem **seus próprios filtros na URL** (prefixos diferentes) — nada vaza entre elas.
- **Histórico** (técnico, completo): lista agrupada, busca limitada ao período, filtros (período, categoria, origem, ator, campanha, nível, status, "incluir avisos da plataforma", "incluir anulados"), painel de detalhe (o que, quando, quem/via, onde, antes/depois **formatados**, origem, evidência saneada, situação da sincronização, revisões), **Registrar atividade**, **Atualizar**.
- **Prestação de contas** (curada): sempre parte de "trabalho do gestor"; cabeçalho (contas, período, "sincronizado há X", lacunas em linguagem simples); cartões de **itens de trabalho** (total, campanhas trabalhadas, otimizações, criativos, orçamento, rastreamento) — clicar filtra a lista; gráfico por dia/semana/mês por origem; "Tudo o que foi feito"; **Avisos da plataforma**; **Resultados no período** em seção visualmente separada, com frase padrão sem causalidade; **Relatórios de prestação de contas** (gerar + anteriores); **Pré-visualizar como cliente**.
- **Formatador por tipo de evento** (tabela no código, testada com o catálogo real): título próprio em pt-BR (corrige títulos em inglês e contraditórios), frase simples para cliente ("Orçamento diário da campanha X: de R$ 50,00 para R$ 18,00"), centavos → moeda, códigos → rótulos, estratégias de lance traduzidas, datas da Meta mostradas como vieram, públicos/direcionamento resumidos, imagens nunca por URL expirada.
- **Pré-visualizar como cliente** (não é o link compartilhável): esconde nomes de pessoas (vira "Gestor"/"Meta"), notas internas, falhas, anulados, presumidos, avisos de plataforma não marcados, app/origem técnica e evidências. Faixa fixa "Pré-visualização — o cliente não tem acesso a esta tela".
- **Registrar atividade** (celular primeiro): modelos rápidos (Reunião, Análise semanal, Ajuste de criativo, Rastreamento, Observação), padrões preenchidos (agora, este cliente), campos mínimos (título, quando, visível ao cliente?), opcionais (campanha, link de evidência, detalhe). Edição livre por 15 min.
- **Estados** distintos: importando histórico (com progresso por dias), conta não vinculada, Meta desconectada desde…, sem dados antes de DD/MM, sincronização parcial, erro — nunca "0 atividades" quando o motivo é falta de dados.
- **Fuso:** o do cliente = fuso da primeira conta vinculada (`ad_accounts.timezone`), padrão America/Sao_Paulo; usado igual na tela e no relatório e gravado no relatório.

### 2.7 Relatório de prestação de contas (v2)
- Nome único: **"Relatório de prestação de contas"**. Fica na aba do cliente; `/reports` ganha só um aviso "Relatórios de prestação de contas ficam no Cliente 360°". Os relatórios de métricas existentes não mudam.
- **Um clique:** botão "Relatório da semana passada" (seg–dom, fuso do cliente) já com padrões; "Personalizar" abre período (hoje, 7 dias, semana passada, este mês, mês anterior, personalizado), contas, categorias, resultados, observações, avisos da plataforma.
- **Antes de gerar:** dispara Atualizar das contas do cliente (com trava) e mostra cobertura do período; se houver lacunas, avisa e deixa gerar mesmo assim (lacuna vai para "Fontes e limitações" em frase simples).
- **Rascunho → Final:** "Gerar" cria rascunho (dados ao vivo, notas editáveis); **Finalizar** congela o snapshot. Final é imutável; correção = novo relatório.
- **Saídas:** página do relatório com CSS de impressão → botão **"Imprimir / Salvar PDF"** (D7); **Copiar para WhatsApp**; **Copiar e-mail**; **Enviar pelo WhatsApp do cliente** (reuso do envio existente, só relatório final). Proibido expor via `shared_links` enquanto o RLS dessa tabela não for corrigido.
- **Resumo:** determinístico (frases por categoria a partir dos totais). IA desligada (D9).

### 2.8 Isolamento e segurança (v2)
- Toda consulta/insert nas tabelas novas filtra `org_id = session.orgId` **explicitamente** (não confiar em RLS, porque o painel usa service role); `client_id` da URL validado contra `clients.org_id`; RPCs recebem a org como parâmetro e validam.
- RLS habilitada mesmo assim (protege o caminho Supabase Auth).
- Agregações (cartões, série temporal, campanhas distintas) em **SQL** (RPC com org explícita), nunca contando linhas no Node (limite de 1.000 do PostgREST).
- `raw` e `actor_name` só para o gestor; `raw` dos eventos de plataforma não é guardado; `raw` retido 180 dias (limpeza registrada em revisões).
- Testes de vazamento entre orgs e entre clientes para cada rota nova.

---

## 3. Registro de decisões (v2)

| # | Decisão | Alternativas | Por quê | Origem |
|---|---|---|---|---|
| D1 | Tabela única com `before/after` normalizados | Tabela `activity_event_changes` | Um evento = um par antes/depois | v1 |
| D2 | `act_{id}/activities` como fonte principal | Só snapshots | Testado: autor, app, antes/depois | v1 |
| D3′ | Chave de dedupe com assinatura de campos estáveis + ordinal; `locale=pt_BR` | Hash do `extra_data` inteiro | Hash inteiro muda entre buscas (verificado) | Cético 1–2, Guardião 5 |
| D4′ | Uma linha por operação, `succeeded/failed/unknown`, gravação aguardada | Linha pedida + concluída; `setImmediate` | Timeout ≠ falha; serverless perde `setImmediate` | Cético 6e, 10 |
| D5 | `detected` fora do MVP | Implementar já | API cobre o caso | v1 |
| D6′ | `counts_as_work` por tabela de classificação por código + itens de trabalho agrupados | Filtrar só ator "Meta" | 1321 transições "humanas" eram efeito colateral | Usuário 1, Cético 8 |
| D7′ | PDF por CSS de impressão, rótulo honesto "Imprimir / Salvar PDF" + WhatsApp em texto | Puppeteer; `@react-pdf` | Sem dependência pesada; reavaliar arquivo gerado no servidor se o celular exigir | Usuário 11 |
| D8′ | Snapshot só ao **finalizar**, enxuto e sem `raw` | Snapshot ao gerar | Rascunho editável; final imutável e leve | Cético 11, Guardião 12 |
| D9 | IA desligada; requisitos para ligar documentados | IA no MVP | Sem chave; risco de injeção e dados pessoais | Guardião 11 |
| D10′ | Duas abas com filtros **independentes** | Filtros compartilhados | Evita filtro técnico vazar para a visão do cliente | Usuário 4 |
| D11′ | "Pré-visualizar como cliente" com lista explícita do que some | Indefinido | Evita vazamento e confusão com link público | Usuário 6 |
| D12′ | Sync por janelas diárias + cobertura por dia + trava por conta, pg_cron :15 | Cursor "último sucesso − 1 h" | Evita inanição, perda de atrasados e corrida | Cético 4, 12; Guardião 1, 3, 4 |
| D13 | Cliente pelo vínculo **na data do evento** (tabela de vínculos) + reatribuição auditada | Carimbo na ingestão | Reatribuição durante atraso iria ao cliente errado | Cético 5 |
| D14 | Imutabilidade por lista fechada de colunas mutáveis + tabela de revisões + bloqueio de DELETE/TRUNCATE | "Imutável por padrão" | O próprio desenho precisava de alguns UPDATEs | Guardião 6, Cético 9 |
| D15 | Isolamento por `org_id`/`client_id` explícito em código + agregação em SQL | Confiar na RLS | Painel usa service role | Guardião 7, 9 |
| D16 | Anulação permitida para qualquer origem, com motivo, sem apagar | Só `manual` | Eventos de teste/cliente errado precisam sair do relatório | Cético 5, 7 |
| D17 | Formatador por tipo de evento testado com o catálogo | Mostrar `extra_data` cru | Centavos, códigos, inglês e títulos contraditórios | Usuário 2, 5 |
| D18 | Nome "Relatório de prestação de contas", só no Cliente 360° | Juntar com `/reports` | Três "relatórios" confundiam | Usuário 3 |
| D19 | Desvio de processo: revisores rodaram em paralelo sobre a v1 | Sequencial | Revisões independentes; todas as objeções integradas na v2 | Processo |

---

## 4. Riscos e limitações (v2)
- Retenção da Meta e janela de 30 dias da primeira carga: antes disso não há como recuperar; a tela diz "sem dados antes de DD/MM".
- Copy e conteúdo do criativo não vêm estruturados; imagens só por URL temporária (não usadas).
- Autoria = nome no Facebook; ações via API aparecem com o dono do token.
- Eventos idênticos no mesmo segundo são distinguidos por ordinal; se a Meta mudar a ordem entre buscas, o risco é de duplicar um dentre iguais (teste automatizado monitora).
- Vínculos anteriores à migration são "presumidos".
- Carga de 30 dias numa conta pesada leva várias execuções (horas), mostrado como "importando".

---

## 5. Revisão multiagente — respostas do designer

**Cético (12):** 1 aceito (D3′, verificado); 2 aceito (ordinal); 3 aceito (ids como texto); 4 aceito (D12′); 5 aceito (D13, D16); 6 aceito (regra 4 v2: casamento estrito, insert com `reconciled_with`, `unknown`); 7 aceito (regra 8 + anulação D16); 8 aceito (D6′ por código); 9 aceito (D14, NULL→valor); 10 aceito (2.5: lê o anterior, corrige 404, gravação aguardada); 11 aceito (fuso do cliente, rascunho/final, cobertura por dia, sem URLs); 12 aceito (:15, carga escalonada, `stale`).

**Guardião (12):** 1 aceito (cobertura por dia, cursor sem URL); 2 aceito (tetos, códigos, prioridade); 3 aceito (gravação por página, `maxDuration`); 4 aceito (índice único parcial + `stale`); 5 aceito (D3′); 6 aceito (D14, FKs SET NULL); 7 aceito (D15) — **e o problema de sessão pré-existente vai para o dono decidir (§6)**; 8 aceito (raw saneado/retido 180 d, ator oculto ao cliente); 9 aceito (agregação SQL, índice parcial, estimativa); 10 aceito (limite persistido, sem GET, comparação constante); 11 aceito (IA desligada com requisitos); 12 aceito (snapshot enxuto, sem `shared_links`).

**Usuário (12):** 1 aceito (D6′ + itens de trabalho); 2 aceito (D17); 3 aceito (D18); 4 aceito (D10′); 5 aceito (frase simples + grupos; objetos de teste → anulação); 6 aceito (D11′); 7 aceito (modelos rápidos + 15 min); 8 aceito (botão semana passada, atualizar antes, rascunho/final, fuso único); 9 aceito (estados distintos); 10 aceito (rótulos "Registrado na Meta"/"Feito pelo painel"/"Informado pelo gestor" + ícone + legenda); 11 **parcialmente aceito** (rótulo honesto + texto WhatsApp; arquivo PDF gerado no servidor fica para v2 se necessário — custo/dependência na Vercel Hobby); 12 aceito (Avisos da plataforma; resultados em seção separada).

## 6. Arbitragem (Integrador)
- Objeções aceitas: 35 de 36; parcialmente: 1 (Usuário 11, justificativa em D7′). Nenhuma rejeitada.
- **Pré-requisito fora do escopo, decisão do dono:** `getDashboardSession` com cookie do painel usa service role e `orgId` de fallback. A Central não depende de corrigir isso (isola por código), mas é um risco de segurança do sistema inteiro.
- Pendências do dono antes de implementar: aprovar a migration (tabelas, gatilhos, RPCs, pg_cron `:15`); confirmar regra de atribuição presumida; decidir sobre IA (chave e provedor) — opcional.
- **Disposição: APROVADO com condições** — implementar só após aprovação da migration; MVP sem `detected` e sem IA.

---

## 7. Produto — brainstorming (product-brainstorming)

### 7.1 Trabalho a ser feito (JTBD)
- **Gestor:** quando o cliente pergunta "o que foi feito?" (ou antes da reunião mensal, ou quando ele ameaça cancelar), quero mostrar em 2 minutos uma prova clara do trabalho, para manter o contrato e justificar a mensalidade. *Emocional:* sentir-se profissional e seguro.
- **Cliente leigo:** quero sentir que alguém está cuidando do meu dinheiro e entender o que mudou, sem jargão.
- **O que é "demitido" hoje:** print do Gerenciador, áudio no WhatsApp, memória do gestor.

### 7.2 Premissa mais arriscada
"O cliente valoriza uma lista de ações." Volume assusta (40 mudanças = "estão testando com meu dinheiro") ou desvaloriza (3 mudanças = "não fizeram nada"). O leigo entende **narrativa**: o que observamos → o que fizemos → **por quê** → o que vamos acompanhar. A Meta nunca informa o porquê.

### 7.3 Ideias que entram no MVP (além do pedido)
1. **Anotar motivo** em qualquer evento (nota manual ligada ao evento via `annotates_id`, sem alterar o original). Motivos anotados aparecem no relatório junto do item. Maior alavanca de valor percebido por esforço.
2. **Texto da semana para WhatsApp como artefato principal**; página do relatório (e PDF por impressão) como formato secundário.
3. **Relatório organizado por narrativa**: Resumo → Principais ações (itens com motivo primeiro) → Demais ajustes agrupados → Resultados (seção separada, sem causalidade) → Próximos passos → Fontes.

### 7.4 Ideias para depois (registradas, fora do MVP)
- Rascunho automático toda segunda-feira (pg_cron) aguardando revisão — nunca envio automático.
- Resumo por IA (D9), PDF gerado no servidor (D7′), origem `detected` (D5), portal do cliente com login, Google Ads, gestão de tarefas (Start Control).

### 7.5 Prioridade
- **P0 — base confiável:** ingestão Meta + captura do sistema; classificação (`counts_as_work`) e formatador; aba **Histórico** com filtros, detalhe, registrar atividade e **anotar motivo**; **Relatório de prestação de contas** (rascunho → final, texto WhatsApp/e-mail, página imprimível).
- **P1 — apresentação:** aba **Prestação de contas** (cartões de itens de trabalho, gráfico por origem, avisos da plataforma, resultados do período, relatórios anteriores, pré-visualizar como cliente).
- **P2 — automação:** rascunho de segunda-feira, IA, PDF no servidor.

### 7.6 Métricas de sucesso
- Relatórios **finalizados** por cliente ativo por semana (meta: 1).
- Tempo de "abrir o cliente" até "enviar": ≤ 3 min.
- % de itens de trabalho com **motivo anotado** no relatório final (meta: ≥ 30 %).
- Cobertura de sincronização: ≥ 99 % dos dias `complete` nas contas ativas.
- Relatórios com evento anulado/reatribuído **após** finalizar: 0 (mede confiança da atribuição).

### 7.7 Teste mais barato antes de construir telas
Gerar, a partir dos dados reais (somente leitura), o **relatório da semana passada do Moving** já classificado, agrupado e formatado, e o gestor responder: "eu enviaria isto ao cliente?". Valida classificação, agrupamento e linguagem antes da UI. É a **primeira nano task** do plano.

---

## 8. Validação do plano (multi-plan) — decisões v3

`/ecc:multi-plan` exige o runtime externo `ccg-workflow` (Codex/Antigravity), **não instalado** nesta máquina; instalar exigiria baixar e executar pacote externo sem autorização. Equivalente usado: subagentes ECC por perspectiva — `ecc:architect` (arquitetura, escalabilidade, código), `ecc:database-reviewer` (schema/migration/RLS) e revisor de integração Meta + testabilidade. Segurança, UX, custos e confiabilidade já tinham passado pelas revisões da §5.

### 8.1 Premissas corrigidas
- **Não existe envio de relatório por WhatsApp** a reaproveitar (`report_runs.sent_at` é marcado à mão; `sendText` só na rota de teste). → "Copiar para WhatsApp" é o P0; envio direto vira tarefa própria (T8b, P1).
- **`graphFetch` não serve** para `/activities`: usa `res.json()` (corrompe ids), não expõe cabeçalhos de uso, sem timeout. Há **duas versões** da Graph no código (`v20.0` fixo e `v21.0` por env).
- **Não há feature flags** no repositório.
- **Não há infraestrutura de teste de rota nem de SQL local** (sem docker/psql/CLI Supabase).

### 8.2 Decisões novas
| # | Decisão | Origem |
|---|---|---|
| D20 | **Janelas adaptativas** dia → 6 h → 1 h (`since`/`until` unix, meio-aberto); ordinal só depois de buscar a subjanela inteira; cobertura por subjanela. Dia pesado nunca fica `partial` para sempre. | Arquiteto 1, Meta 1 |
| D21 | Classificação pelo par (`event_type`, `object_type`) e autoria por `actor_id`/`application_id` (não por nomes traduzidos). Assinatura sem `object_name`/`actor_name`; campo `dedupe_version`. | Meta 2, 5 |
| D22 | Novo `graphRequest` em `lib/meta/client.ts` → `{status, headers, text}`, timeout, **constante única de versão**, códigos 1/2/4/17/32/613/80000–80014, subcódigo 2446079, 2635; para a conta com uso > 75 % e grava `throttled_until`. | Arquiteto 7, Meta 3, 4, 8 |
| D23 | `category`, `counts_as_work`, `classifier_version` mutáveis **só** pela RPC `reclassify_activity_events` (com revisão). Agrupamento de trabalho **só em SQL** (gaps-and-islands) — sem `work_group_key`. `raw` em tabela separada `activity_event_raw` (sem SELECT para `authenticated`), removida por retenção de 180 dias via função dedicada. | Arquiteto 2, DB 3 |
| D24 | FKs **compostas** `(org_id, client_id)` e `(org_id, ad_account_id)` com **RESTRICT** (arquivar não remove; cliente com histórico não é excluído fisicamente). `UNIQUE (org_id, id)` em `ad_accounts` criado `CONCURRENTLY`. | DB 1 |
| D25 | Imutabilidade comparando `to_jsonb(NEW) - mutáveis`; mudanças de `client_id`/`attribution` só sob flag de sessão setada pela RPC; edição manual de 15 min por `recorded_at` + ator passado pela RPC; revisões imutáveis; REVOKE das permissões de escrita. Limite documentado: dono do banco pode desligar gatilhos. | DB 2 |
| D26 | RPCs exigem `p_org_id` (sem default), validam **todos** os ids, `search_path` fixo, `EXECUTE` só para `service_role`. Inserção em lote por RPC `insert_activity_events` que devolve inseridos/ignorados. | DB 4, 10; Meta 10 |
| D27 | Trava de sync com **heartbeat** por página; RPC `acquire_activity_sync_run` (marca `stale` > 3 min sem heartbeat, limite manual sob advisory lock de transação); cobertura nunca regride. | DB 8 |
| D28 | `ad_account_client_assignments` com `EXCLUDE USING gist` (sem sobreposição), `presumed` no backfill. | DB 7 |
| D29 | Migrations em 4 arquivos (eventos · sync · relatórios · agendamento) testadas em **PGlite** (já no lockfile; vira devDependency) com papéis e stubs de `auth`. | Arquiteto 3, Meta 10 |
| D30 | Núcleos com dependências injetadas (padrão `reports/generate-core.ts`); rotas finas; módulos puros sem `@/` (harness de teste). Fixtures = **texto bruto** saneado, duas capturas da mesma janela. | Arquiteto 5, Meta 9, 12 |
| D31 | Flags em `lib/activity/flags.ts`: `ACTIVITY_CAPTURE_ENABLED` (captura e sync, ligada cedo para acumular histórico) e `ACTIVITY_HISTORY_ENABLED` (UI e APIs; 404 quando desligada). | Arquiteto 10 |
| D32 | Correção do conjunto (404): `GET /{id}?fields=account_id,…` com token da org → validar que a conta é da org → só então `POST`; checar CBO/vitalício pela leitura; **leitura falhou = não altera**. Um POST com 2 campos casa com N eventos Meta. | Meta 6 |
| D33 | Reuso: `reports/period.ts` (helpers de data), `reports/engine/metrics` + `dashboard/cards` para resultados, `reports/http.ts` extraído para `lib/http/route.ts`. Narrativa fora do motor `{{slug}}`. | Arquiteto 9 |
| D34 | Fila por cobertura mais antiga; capacidade = 60 chamadas/h ÷ janelas por conta (documentada); `meta-sync` também lê o cabeçalho de uso. Agendamento no minuto **:07** (fora de :00/:30 do meta-sync e dos múltiplos de 5 do dispatch). | Arquiteto 8, DB 12 |
| D35 | `annotates_id` (FK para o próprio evento) para "anotar motivo". | Arquiteto 3 |
| D36 | Cobertura ≥ 99 % definida por SQL: dias **fechados** de contas ativas com status `complete` ÷ dias fechados. | Meta 13 |

### 8.3 A verificar na T1 (suposições marcadas pelos revisores)
`until` inclusivo ou não; cota contabilizada por `/activities` (campo `type` do cabeçalho); runtime Node da Vercel ≥ 21 (para `context.source`); retenção máxima do histórico (consulta de 13 meses); se `object_name` é o nome na época ou o atual.

### 8.4 Disposição
**APROVADO com ajustes** pelos três revisores; todos os achados críticos/altos incorporados acima e no plano v3 (`historico-prestacao-contas.md`).

### 8.5 Decisões do dono após o protótipo (21/10/2026)
- Ações feitas pelo app "ANTIGRAVITY-GESTOR DE TRAFEGO" são do **agente de automação do próprio gestor** e **contam como trabalho** (`actor_kind = integration`, rótulo "Feito via automação do gestor").
- Protótipo da semana do Moving e telas do Figma aceitos como direção; ajustes finos durante a implementação.
