# Plano de Execucao MVP - SaaS Tracking + Campanhas

## Goal
Entregar o MVP funcional do produto com onboarding, tracking, atribuicao, dashboard e multi-cliente em ambiente de producao inicial.

## Tasks
- [ ] Definir stack final e bootstrap monorepo (`web`, `api`, `worker`) -> Verify: repositorio sobe local com `docker compose up` sem erros.
- [ ] Implementar autenticacao, organizacao, usuarios e RBAC -> Verify: owner cria usuario analyst e permissao e respeitada nas rotas.
- [ ] Criar schema inicial PostgreSQL (clientes, contas ads, eventos, pedidos, atribuicoes) -> Verify: migracao aplica limpa e testes de integridade passam.
- [ ] Integrar Meta Ads com sync inicial + incremental -> Verify: campanhas e custos dos ultimos 30 dias aparecem por cliente.
- [ ] Implementar tracking endpoint com deduplicacao (`event_id`) e persistencia de UTMs/click IDs -> Verify: eventos duplicados nao geram contagem dupla.
- [ ] Integrar fonte de vendas inicial (Shopify ou Stripe) com reconciliacao -> Verify: pedido confirmado aparece no pipeline e pode ser atribuido.
- [ ] Implementar motor de atribuicao `last_click` e camada de metricas diarias -> Verify: venda teste gera credito correto na campanha esperada.
- [ ] Entregar dashboard web com ROAS, CPA, faturamento e lucro por campanha -> Verify: filtros por cliente/canal/periodo funcionam e valores batem com consultas SQL.
- [ ] Configurar observabilidade minima (logs estruturados, healthcheck, alerta de job falho) -> Verify: falha simulada em worker gera alerta.
- [ ] Executar hardening de seguranca e checklist LGPD basico -> Verify: secrets fora do codigo, TLS ativo e endpoint de exclusao de dados disponivel.

## Done When
- [ ] Usuario conecta conta de ads e fonte de vendas sem suporte manual.
- [ ] Dashboard mostra lucro por campanha com atribuicao rastreavel.
- [ ] Plataforma opera com monitoramento basico e controles de acesso multi-cliente.

## Notes
Dependencias criticas: RBAC antes do dashboard multi-cliente, tracking antes de atribuicao, conectores de venda antes do calculo de lucro.
