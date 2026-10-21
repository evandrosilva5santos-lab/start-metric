# Integração Google Ads — levantamento e plano

Status: **planejado, aguardando a Central de Histórico** · 21/10/2026
Decisões do dono: acesso por **OAuth ("Conectar Google Ads") e por conta de serviço**; prioridade **depois** da Central de Histórico.

## 1. O que existe em `/Volumes/Vol Macbook/App/Pessoal/Google ads` (verificado, somente leitura)

| Item | O que é | Aproveitamento |
|---|---|---|
| Guias `.md` (API completa, CampaignService, palavras-chave, erros, cenários) | Documentação de uso da Google Ads API em Python (escrita para v18+) | **Referência**: consultas GAQL, conversão de micros, padrões de mutação. Conferir cada detalhe contra a doc oficial da versão vigente antes de usar. |
| `google_ads_keyword_operations.py`, `EXAMPLE-RUNNABLE-CODE.py`, `check_customers.py` | Biblioteca Python (cliente oficial `google-ads`) | **Lógica** portável para TypeScript (o painel roda em Next.js na Vercel; não há Python no servidor). |
| `google-ads-mcp/` | MCP oficial do Google Ads (o mesmo conectado ao Claude) | **Ferramenta de desenvolvimento**: consultar contas reais enquanto implemento. Hoje sem credencial (falta login padrão do Google Cloud). Não vai para o app. |
| `Cliente/` (Go English, Arroba, Fenster, Sanger) | Auditorias, relatórios e scripts por cliente | **Mapa de contas**: MCC `720-574-9286` ("ADM PRINCIPAL"); Arroba `341-848-9444`; Go English `197-302-1190`. São os mesmos clientes já cadastrados no painel. Os scripts da Go English fizeram **alterações reais** (negativas, pausas, campanhas) → o developer token já teve acesso a contas de produção. |
| `venv/` (4,9 GB) | Ambiente Python | Descartável para o painel. |
| `~/.claude/google-service-account.json` | Chave de conta de serviço `startin-google-ads@mystic-benefit-438919-j1…` | Base do modo **conta de serviço**. O developer token **não** está nele (ficava num `google-ads-service.yaml` que não existe nesta máquina). |

## 2. Arquitetura proposta (resumo)
- **Duas formas de credencial, uma camada só:** `google_connections` (OAuth: refresh token criptografado com pgcrypto, como o token Meta) e conta de serviço (chave fora do banco, em variável de ambiente da Vercel). Ambas produzem um access token para o mesmo cliente HTTP.
- **Chamadas REST** da Google Ads API no servidor (`googleAds:searchStream` e `mutate`), com `developer-token` e `login-customer-id` = MCC. Versão estável vigente confirmada no início da implementação.
- **Contas:** `ad_accounts` com `platform = 'google'` (a tabela já tem a coluna), escolha de contas e vínculo a clientes reaproveitando a Carteira (e o histórico de vínculos criado na T3a).
- **Métricas:** sincronização incremental por dia (mesmo padrão do `meta-sync`, pg_cron), custo em micros → moeda da conta.
- **Histórico:** `change_event` (últimos 30 dias, até 10.000 linhas por consulta) entra na Central como nova origem. Exige uma migration pequena: hoje `activity_events.source` aceita `meta | system | manual | detected`.
- **Escrita (pausar, orçamento, palavras-chave):** sempre no servidor, com confirmação na tela e registro na Central com resultado `succeeded | failed | unknown`.
- **Consolidado Meta + Google:** lado a lado; conversões e receitas **não** são somadas sem metodologia de deduplicação.

## 3. O que só você pode fazer (sem isso a integração não autentica)
1. **Developer token:** Google Ads do MCC → Administrador → Centro de API. Anotar o **nível de acesso** (Teste, Explorador, Básico ou Padrão).
2. **OAuth client (projeto "make" que você enviou):**
   - em *URIs de redirecionamento autorizados*, adicionar `https://start-metric.vercel.app/api/google/callback` (e `http://localhost:3000/api/google/callback` para testes locais);
   - na *Tela de consentimento OAuth*, incluir o escopo `https://www.googleapis.com/auth/adwords` e **publicar em produção**: em modo "Teste" o Google invalida o refresh token em 7 dias;
   - **gerar um novo Client Secret**: o atual foi colado no chat.
3. **Conta de serviço:** em Google Ads do MCC → Administrador → Acesso e segurança, adicionar `startin-google-ads@mystic-benefit-438919-j1.iam.gserviceaccount.com` como usuário.
4. **Variáveis na Vercel** (Settings → Environment Variables), preenchidas por você: `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (= `7205749286`) e, para o modo conta de serviço, `GOOGLE_ADS_SERVICE_ACCOUNT_JSON`.

## 4. Ordem de entrega (depois da Central)
1. Conexão (OAuth + conta de serviço) e seleção de contas → 2. sincronização de campanhas e métricas → 3. painel Google Ads → 4. operações (pausar/ativar, orçamento, palavras-chave, negativas) → 5. histórico (`change_event`) na Central → 6. relatórios → 7. visão consolidada Meta + Google.
Cada etapa só é marcada como concluída depois de autenticar e ler/escrever numa conta real.
