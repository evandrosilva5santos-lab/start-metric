# Painel de métricas e relatórios — otimização e porte do Metrifiquei

## Goal
Uma fonte única de números para Visão geral, Performance e Relatórios, e o sistema de relatórios/alertas do Metrifiquei rodando dentro do Start Metric, no tema ADZ.

Detalhe técnico e schema: [docs/PLANO_RELATORIOS_NOTIFICACOES.md](docs/PLANO_RELATORIOS_NOTIFICACOES.md). Motor de templates já pronto em `apps/dashboard/src/lib/reports/engine/` (12 testes, `npm run test:reports`).

## Tasks
- [ ] 1. **Visão geral lê do banco.** Trocar `MetaDataGate` + `/api/meta/dados` (Meta ao vivo no navegador, cache em memória) por `getDashboardData` renderizado no servidor, como `performance/page.tsx`. → Verify: `/` e `/performance` mostram o mesmo investimento no mesmo período; abrir `/` não gera request a `graph.facebook.com`.
- [ ] 2. **Sync guarda conversões por tipo.** Migration: `daily_metrics` ganha `actions jsonb` e `action_values jsonb`; `/api/cron/meta-sync` passa a gravar o que já baixa. → Verify: após um sync, uma linha tem `actions->>'purchase'` preenchido.
- [ ] 3. **Coletor de métricas dos relatórios.** `lib/reports/engine/metrics.ts`: banco → slugs do catálogo; Insights ao vivo só para alcance, frequência, vídeo e criativos. Corrige o ROAS ponderado pelo tamanho do nome. → Verify: teste com linhas sintéticas devolve `meta_actions.purchase` e ROAS = receita / investimento.
- [ ] 4. **Tabelas de relatórios, alertas e leads.** Migration de `message_templates`, `reports`, `report_parts`, `report_runs`, colunas novas em `notification_rules`, `lead_webhooks`, `leads`, com RLS por `org_id`. Aplicar no Supabase só com aprovação. → Verify: usuário de outra org não lê nenhuma linha; `unique (report_id, scheduled_for)` rejeita duplicata.
- [ ] 5. **API de relatórios.** `app/api/reports/**`: CRUD, preview com dado real (modo `live`) e "gerar agora". Fora de escopo: envio por WhatsApp. → Verify: `curl` cria relatório, preview devolve `{ text, missing }`, "gerar agora" cria um `report_run`.
- [ ] 6. **Direção visual de Relatórios e Alertas.** As telas já existem no Figma do Start Control (https://www.figma.com/design/WD0LDPkm43lSkkgV9YzMAs, páginas Desktop 1440 e Celular 393). Validar com brand-discovery / frontend-design-direction e trazer com figma-design-to-code, decidindo antes qual tema vale (ADZ escuro atual ou Start Control). → Verify: telas de Relatórios e Alertas definidas em 1440 / 834 / 390 e aprovadas pelo usuário.
- [ ] 7. **UI de Relatórios.** Editor em tela cheia com `/` para variável, preview, partes ilimitadas e histórico com "copiar texto", fiel aos mockups da tarefa 6. → Verify: criar, pré-visualizar e gerar um relatório no navegador nas 3 larguras.
- [ ] 8. **Geração agendada.** `app/api/cron/reports-dispatch` + `vercel.json`, idempotente por `report_runs`. Fora de escopo: envio por WhatsApp. → Verify: duas chamadas simultâneas ao cron geram um único run.
- [ ] 9. **Alertas com template.** Regras usam `ALERT_PRESETS` + condições novas (saldo, CTR, erro de conta) e mostram o texto renderizado no painel. → Verify: regra de CPA dispara com o texto do template e valores reais.
- [ ] 10. **Verificação.** `npm run typecheck`, `npm run test:reports`, `npm run build`; Chrome DevTools em `/`, `/performance` e `/reports`: console sem erro, sem request à Meta em `/`, LCP medido antes e depois da tarefa 1. → Verify: tudo verde e números do antes/depois registrados aqui.

## Done When
- [ ] Visão geral, Performance e Relatórios mostram o mesmo número para o mesmo período.
- [ ] Um relatório agendado é gerado com dado real, sem nenhum valor inventado.

## Notes
- Fora de escopo neste plano: WhatsApp (pedido do usuário, 16/10/2026), webhook de leads (só a tabela entra), Google Ads.
- Ordem crítica: 1 → 2 → 3 → 4 → 5 → 7 → 8. A 6 roda em paralelo com 2–5. A 9 depende da 4.
- Banco real usa nomes sem prefixo e `org_id`; o `SCHEMA.md` está desatualizado.
- **Visão de futuro (usuário, 16/10/2026):** este painel vai virar o sistema completo de gestão e clientes, o **Start Control**. Specs, protótipos e o arquivo do Figma estão em `/Volumes/Vol Macbook/App/ANOTA TUDO/start-control/`. Modelos de dados e navegação devem deixar espaço para os módulos dele (Carteira, Cliente 360°, Operação, Financeiro…), sem construí-los agora.
