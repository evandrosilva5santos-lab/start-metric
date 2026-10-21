# Equipe de agentes — Unificação, Relatórios e Notificações

Estes arquivos são prompts operacionais portáveis: podem ser entregues a Claude, Codex, Cursor ou outra IA. Cada agente tem responsabilidade e área de alteração próprias.

## Como usar

1. O **Orquestrador** cria uma nano task aprovada em `execution/CURRENT_TASK.md` antes de qualquer alteração de código ou banco.
2. Copie o arquivo do agente escolhido junto com a nano task e a documentação indicada nele.
3. Um agente só altera o seu escopo. Se precisar de contrato de outro módulo, pede ao Orquestrador — não altera por conta própria.
4. O agente devolve diff, testes executados, decisões, riscos e handoff. O Orquestrador só libera o próximo após validação.

## Equipe

| Agente | Responsabilidade | Depende de |
|---|---|---|
| `00-orquestrador.md` | Ordem, contratos, bloqueios e integração final | — |
| `01-engine-relatorios.md` | R1: catálogo, renderização e presets | — |
| `02-metricas-meta.md` | R2: Meta Insights e agregações | R1 |
| `03-banco-rls.md` | R3: migration, tipos e políticas de acesso | R1; aprovação explícita do banco |
| `04-api-relatorios.md` | R4: CRUD, preview real e gerar agora | R1–R3 |
| `05-ui-relatorios.md` | R5: editor, preview e histórico | R4 |
| `06-agendamento.md` | R6: cron, reserva atômica e retentativas | R3–R4 |
| `07-alertas-leads.md` | N1/N2: alertas editáveis e webhook de leads | R1, R3 |
| `08-qualidade-seguranca.md` | Auditoria de aceitação, RLS e regressão | Após cada entrega |
| `09-limpeza-legado.md` | C1: remoção de código morto após migração | R1–R6, N1/N2 |

## Limite de concorrência

- Podem ocorrer em paralelo: R1 e o levantamento de R3; N1 e N2 depois da migration; revisão de qualidade em paralelo à implementação, apenas como leitura.
- Não podem ocorrer em paralelo: duas migrations, dois agentes no mesmo módulo/rota, ou UI antes do contrato da API estar aprovado.
- A migration R3 exige aprovação expressa antes de ser aplicada ao Supabase compartilhado.
