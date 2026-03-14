# Roundmap de Execucao - Start Metric

Atualizado em: `2026-03-10`

## Status real (feito x falta)

### Feito (evidencia no codigo)
- Dashboard visual principal com KPIs, grafico, filtros e tabela de campanhas.
- Fluxo de auth com Supabase (`/auth`, callback, protecao de rotas por `proxy.ts`).
- Multi-tenant base com `organizations`, `profiles`, RLS e policies.
- Integracao Meta Ads base: OAuth, contas, sync, insights e desconexao.
- API de tracking com deduplicacao por `(org_id, event_id)`.
- Motor de alertas: regras, leitura, monitor de alertas e endpoint cron.
- Deploy de preview executado e registrado em `DEPLOY_LOG.md`.

### Parcial
- Roadmap/PLANs estao desatualizados em relacao ao codigo.
- Tracking client foi iniciado (page_view automatico), faltando ampliar cobertura de eventos de negocio.
- Atribuicao avancada (alem de metrica agregada atual) ainda nao esta completa.

### Faltando (prioridade alta)
- Integracao de vendas (Shopify/Woo/Stripe) e reconciliacao.
- Motor de atribuicao formal (last_click pronto de ponta a ponta, depois first_click/linear).
- Exportacao de relatorios.
- Escala de arquitetura (API/worker desacoplados e monorepo alvo com NestJS, se mantido no escopo).

## Estagio atual
- Fase PRD (visual): entre **Fase 1** e **Fase 3** em termos de UI e integracoes base.
- Fase PRD (dados de negocio): **Fase 2** incompleta por falta da camada de vendas + atribuicao completa.
- Proximo marco de valor: fechar tracking + vendas + atribuicao last_click para lucro real rastreavel.

## Prioridade para "ter algo visual"
1. Manter e divulgar preview ativo (feito).
2. Melhorar onboarding visual de conexao Meta e estados vazios (rapido impacto).
3. Exibir funil Tracking -> Venda -> Atribuicao no dashboard (valor percebido imediato).

## Inventario de execucao para outras IAs

### Agentes disponiveis (.agents/agents)
- orchestrator
- project-planner
- product-manager
- product-owner
- frontend-specialist
- backend-specialist
- database-architect
- devops-engineer
- qa-automation-engineer
- test-engineer
- debugger
- performance-optimizer
- security-auditor
- documentation-writer
- code-archaeologist
- explorer-agent
- seo-specialist
- mobile-developer
- game-developer
- penetration-tester

### Workflows disponiveis (.agents/workflows)
- brainstorm
- plan
- orchestrate
- create
- enhance
- debug
- test
- preview
- deploy
- status
- ui-ux-pro-max

### Skills principais para este projeto
- brainstorming
- plan-writing
- intelligent-routing
- architecture
- database-design
- nodejs-best-practices
- nextjs-react-expert
- testing-patterns
- performance-profiling
- deployment-procedures
- webapp-testing
- code-review-checklist
- vercel-deploy (codex)

## Execucao etapa por etapa (com pente fino)

### Etapa 1 - Deploy visual e registro
Status: `CONCLUIDA`

Pente fino antes de executar:
- `npm run lint`
- `npx next build --webpack`
- Validar rotas geradas no build

Prompt de execucao:
`@orchestrator coordene @frontend-specialist @devops-engineer para validar build visual do start-metric, gerar pacote de deploy enxuto, publicar preview no Vercel e registrar URLs/IDs em DEPLOY_LOG.md`

Agentes sugeridos:
- orchestrator
- frontend-specialist
- devops-engineer
- documentation-writer

Skills:
- nextjs-react-expert
- deployment-procedures
- vercel-deploy
- documentation-templates

Workflows:
- preview
- deploy
- status

### Etapa 2 - Alinhar roadmap real com codigo
Status: `CONCLUIDA`

Pente fino antes de executar:
- Conferir `PLAN.md`, `masterplan.md`, `PRD.md`, `prd-saas-tracking-gestao-campanhas.md`
- Conferir endpoints/migrations existentes no `start-metric`

Prompt de execucao:
`@orchestrator com @project-planner e @code-archaeologist gere matriz feito/parcial/faltando por fase do PRD e atualize ROUNDMAP_EXECUCAO.md sem perder evidencias tecnicas`

Agentes sugeridos:
- orchestrator
- project-planner
- code-archaeologist
- documentation-writer

Skills:
- plan-writing
- architecture
- documentation-templates

Workflows:
- plan
- status
- orchestrate

### Etapa 3 - Tracking client SDK + eventos completos
Status: `CONCLUIDA (MVP incremental)`

Pente fino antes de executar:
- Validar estrutura `tracking_events` no banco
- Testar dedupe de `event_id` no endpoint
- Revisar seguranca de payload e limites

Prompt de execucao:
`@orchestrator com @backend-specialist e @frontend-specialist implemente SDK client de tracking (page_view, add_to_cart, purchase), envie para /api/tracking/events com event_id unico e valide deduplicacao por organizacao`

Agentes sugeridos:
- orchestrator
- backend-specialist
- frontend-specialist
- qa-automation-engineer

Skills:
- nodejs-best-practices
- api-patterns
- testing-patterns
- systematic-debugging

Workflows:
- create
- test
- debug

Resultado desta rodada:
- Bootstrap global de tracking adicionado no layout.
- Envio automatico de `page_view` em navegacao de paginas autenticadas.
- Captura de `session_id`, UTMs e click IDs no client antes do envio ao endpoint.
- Build e lint validados apos a implementacao.

### Etapa 4 - Integracao de vendas (primeira fonte)
Status: `PENDENTE`

Pente fino antes de executar:
- Confirmar schema para pedidos, itens e status de pagamento
- Definir primeira fonte (Shopify ou Stripe) com menor risco
- Validar idempotencia de ingestao

Prompt de execucao:
`@orchestrator com @backend-specialist @database-architect implemente conector de vendas inicial (Stripe recomendado), persistencia idempotente de pedidos e reconciliacao minima para atribuicao`

Agentes sugeridos:
- orchestrator
- backend-specialist
- database-architect
- security-auditor

Skills:
- database-design
- nodejs-best-practices
- api-patterns
- testing-patterns

Workflows:
- plan
- create
- test

### Etapa 5 - Atribuicao last_click ponta a ponta
Status: `PENDENTE`

Pente fino antes de executar:
- Garantir click IDs/UTMs em tracking e pedidos
- Definir janela de atribuicao e regras de empate
- Validar consistencia por timezone da organizacao

Prompt de execucao:
`@orchestrator com @backend-specialist @database-architect implemente motor last_click com trilha de auditoria por pedido e expose metricas atribuidas no dashboard`

Agentes sugeridos:
- orchestrator
- backend-specialist
- database-architect
- qa-automation-engineer

Skills:
- architecture
- database-design
- testing-patterns
- performance-profiling

Workflows:
- plan
- create
- test
- status

### Etapa 6 - Dashboard de atribuicao e funil visual
Status: `PENDENTE`

Pente fino antes de executar:
- Validar queries de lucro/ROAS/CPA atribuido
- Garantir estados de loading/empty/error coerentes
- Medir impacto de performance no render

Prompt de execucao:
`@orchestrator com @frontend-specialist e @backend-specialist adicione visao de funil tracking->pedido->atribuicao e cards de lucro atribuido por campanha`

Agentes sugeridos:
- orchestrator
- frontend-specialist
- backend-specialist
- performance-optimizer

Skills:
- nextjs-react-expert
- frontend-design
- webapp-testing
- performance-profiling

Workflows:
- ui-ux-pro-max
- enhance
- preview
- test

### Etapa 7 - Observabilidade e confiabilidade
Status: `PENDENTE`

Pente fino antes de executar:
- Verificar cron jobs ativos (meta-sync, alerts-monitor)
- Mapear logs estruturados e correlation id
- Definir alerta de falha de job e SLA basico

Prompt de execucao:
`@orchestrator com @devops-engineer @backend-specialist implemente healthchecks, logs estruturados e alertas de falha para jobs criticos`

Agentes sugeridos:
- orchestrator
- devops-engineer
- backend-specialist
- security-auditor

Skills:
- deployment-procedures
- server-management
- performance-profiling
- vulnerability-scanner

Workflows:
- deploy
- status
- test

### Etapa 8 - Release candidate e fechamento de fase
Status: `PENDENTE`

Pente fino antes de executar:
- Rodar regressao funcional principal
- Revisar checklist LGPD e seguranca minima
- Atualizar documentacao operacional

Prompt de execucao:
`@orchestrator com @qa-automation-engineer @documentation-writer gere release candidate MVP, checklist de pronto e plano de rollout/rollback`

Agentes sugeridos:
- orchestrator
- qa-automation-engineer
- test-engineer
- documentation-writer
- devops-engineer

Skills:
- testing-patterns
- code-review-checklist
- deployment-procedures
- documentation-templates

Workflows:
- test
- deploy
- status

## Ordem de execucao recomendada agora
1. Fechar Etapa 2 (alinhamento documental e backlog tecnico real).
2. Executar Etapa 3 (SDK tracking client).
3. Executar Etapa 4 (fonte de vendas inicial).
4. Executar Etapa 5 (atribuicao last_click).
5. Executar Etapa 6 (funil visual no dashboard).
