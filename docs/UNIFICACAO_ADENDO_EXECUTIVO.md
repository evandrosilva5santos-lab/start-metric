# Adendo executivo — unificação, relatórios e notificações

**Status:** referência operacional complementar. Não substitui `PRD.md`; resolve divergências específicas de `PRD_UNIFICACAO.md` conforme análise do banco e código em 16/10/2026.

## Decisões efetivas

| Tema | Decisão a executar |
|---|---|
| Banco | Seguir schema real: `org_id` e tabelas sem prefixo. Não criar `startmetric_*`. |
| Motor de templates | Canônico em `apps/dashboard/src/lib/reports/engine/`; `packages/reports` é legado a remover somente no C1. |
| Dados de relatório | Meta Insights na geração; `daily_metrics` é fallback. Live não exibe valores de exemplo. |
| Entrega | Sem WhatsApp/e-mail nesta fase. Gerar, salvar no histórico e permitir copiar texto. `deliver(run)` fica isolado. |
| Persistência | `reports`, `report_parts` e `report_runs`; não criar tabelas 1:1 de schedule/delivery. |
| Segurança | Todas as novas entidades usam `org_id`, RLS/grants mínimos e testes de isolamento. |
| Migração | Aditiva e aprovada antes de aplicar no Supabase compartilhado. |

## Fila final de execução

```text
R1 Engine ─► R2 Métricas Meta ─┐
R1 Engine ─► R3 Banco/RLS (aprovação antes de aplicar) ─┼─► R4 API ─► R5 UI
                                                         │       └──► R6 Agendamento
                                                         └─► N1 Alertas / N2 Leads
R1–R6 + N1/N2 ─► C1 Limpeza de legado
```

Dependência efetiva: R4, R6, N1 e N2 não podem usar as novas tabelas até R3 ser aplicado e validado. R2 pode preparar o coletor em paralelo à aprovação da migration.

## Agentes prontos para despacho

Os prompts e limites da equipe estão em `agents/`. O Orquestrador deve criar uma nano task por vez e observar o `CURRENT_TASK.md` vigente. Até a autorização mudar, a única tarefa de código liberada é `NANO-005.02.01` (atribuição last-click); os agentes deste adendo ficam em modo de preparação.

## Condição de conclusão da unificação de relatórios

- Motor live sem dados inventados.
- Métricas reais e agregações corretas.
- Schema e RLS validados em ambiente seguro.
- CRUD, preview, geração manual, histórico e cron idempotente funcionando.
- Alertas e leads funcionais no painel.
- Testes de isolamento, falhas externas, typecheck e build aprovados.
- Código legado removido apenas depois da migração validada.
