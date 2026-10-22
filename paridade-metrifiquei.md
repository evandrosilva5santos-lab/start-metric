# Paridade com o Metrifiquei

## Goal
Deixar o Start Metric servindo para métricas **e** para gerir os anúncios dos clientes como o Metrifiquei, sem Kanban e sem CRM (o dono usa o Start CRM). Estudo de base: `docs/PLANO_PARIDADE_METRIFIQUEI.md`.

## O que já existe (não refazer)
- Relatórios recorrentes diário/semanal/mensal com `next_run_at` e cron `reports-dispatch` (`lib/reports/schedule.ts`, `dispatch.ts`).
- Partes de relatório por conta com período e texto com variáveis (`report_parts`, `engine/render.ts`).
- `message_templates` (relatório/alerta/lead), sem condicionais.
- Link compartilhado com senha, validade e limite de acessos (`shared_links`).
- Alertas de ROAS/CPA/gasto sem conversão/CTR/erro de API, só aviso, canal web push.
- Google Ads: conexão, contas, campanhas e métricas diárias (`lib/google-ads`, commit `0885ae9e`).

## Tasks
- [x] **T1 Catálogo** (247 variáveis; seletor agora mostra Google e totais) — corrigir `google_conversion_value` → `google_conversions_value`; adicionar variáveis Google de identificação/moeda, as "totais" Meta+Google (`spend`, `impressions`, `clicks`, `ctr`, `cpc`, `cpm`, `conversions`, `account_name`, `currency`, `campaign_name`) e as 23 do Instagram marcadas como "requer conexão". → Verify: `npm test` (reports-engine) com testes novos de slug e de "totais".
- [x] **T2 Google nos relatórios** (validado com o Go English: totais, nomes, resultado principal) — `PartDataSource.loadGoogleRows` + função pura `googleMetricValues(rows)` e `totalMetrics(meta, google)` em `engine/metrics.ts`; `renderLivePart` usa contas Google do cliente. → Verify: testes RED→GREEN; preview de uma parte com `{{google_spend}}` e `{{spend}}` para o Go English bate com `/google-ads`.
- [x] **T3 Google: métricas extras** (30 dias reprocessados; parcelas somam 100%; palavras-chave e índice de qualidade ao vivo) — migration com colunas de parcela de impressões (pesquisa, perdida por orçamento/rank, display), topo %/topo absoluto %, todas as conversões e valor, visualizações/CPV/taxa de vídeo; GAQL e mapper atualizados; ranking de palavras-chave + quality score buscados ao vivo na hora do relatório. → Verify: testes de mapper; dry-run da migration; sync real traz os campos.
- [x] **T4 Segmentos e Produtos** (CRUD validado em produção; migration 20261022000600 aplicada) — tabelas `client_segments`/`client_products` (nome + cor, por org), `clients.segment_id/product_id`, CRUD em Configurações, seletor no cadastro do cliente e filtro na Carteira. → Verify: teste PGlite da migration; criar, atribuir e filtrar no Chrome.
- [x] **T4b Visão geral Meta + Google** (pedido do dono no meio da T4) — seletor do topo com Meta Ads / Google Ads / Meta + Google; comparativo por canal + total e investimento diário empilhado; Meta sem conversão usa o resultado principal. → Verificado: Esquadrias Fenster 30 dias, somas e taxas conferidas.
- [ ] **T5 Condicionais nos textos** — bloco `{{#se meta_roas > 3}}…{{senão}}…{{/se}}` no `renderTemplate` (puro, com operadores `< > <= >= == !=`), usado em relatórios, alertas e modelos. → Verify: testes do renderer, inclusive variável ausente e bloco aninhado inválido.
- [ ] **T6 Regras automáticas** — tabela `automation_rules` (cliente, plataforma, nível campanha/conjunto/anúncio, métrica, operador, valor, período, ação pausar/ativar/±orçamento com %, modo simular/executar, limite diário); avaliação no cron de alertas; execução via Meta Graph e Google Ads mutate; cada execução vira evento na Central de Histórico. → Verify: testes do avaliador (decide ação, respeita cooldown e limite); modo simular no Chrome; uma execução real só com OK do dono.
- [ ] **T7 Relatórios: envio e IA** — frequência quinzenal; envio automático por WhatsApp (Evolution) com chave de idempotência `(report_id, scheduled_for)`; parte "análise por IA" via OmniRoute que só resume números já calculados. → Verify: testes de dispatch (não envia duas vezes); envio de teste para o número do dono.
- [ ] **T8 Dashboard incorporável** — rota `/embed/[token]` usando o `shared_links` existente, com CSP `frame-ancestors` liberada só nela. → Verify: abrir o link num iframe de teste; demais rotas continuam bloqueando iframe.
- [ ] **T9 Instagram pré-configurado** — tabelas `instagram_accounts`/`instagram_daily_metrics`, aba Integrações → Instagram com checklist de permissões e botão desligado até `INSTAGRAM_ENABLED`. Sem sync. → Verify: migration testada; aba aparece; variáveis do Instagram aparecem como "requer conexão".
- [ ] **T10 Verificação final** — typecheck, lint, todos os testes, build, deploy, revisão de código e de segurança por agente, passeio no Chrome por cada tela nova. → Verify: tudo verde e publicado.

## Done When
- [ ] Um relatório de cliente usa variáveis Meta, Google e totais na mesma mensagem.
- [ ] Uma regra automática pausa/ajusta orçamento (simulada e, com OK do dono, real) e aparece no Histórico.
- [ ] Instagram fica a uma variável de ambiente + permissões de distância.

## Notes
- Ordem pensada por risco: T1–T3 só leitura; T6 escreve na conta do cliente e começa em modo simular.
- Migrations no banco compartilhado: sempre dry-run com rollback antes de aplicar.
- Não dá para trazer saldo da conta Google pela API de forma confiável (depende de faturamento por conta); fica fora.
