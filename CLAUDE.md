# CLAUDE.md — Guia de Execução para Claude Code

## Comandos Comuns
- Iniciar painel localmente: `npm run painel` (ou `npm run dev`)
- Validação de tipagem: `npm run typecheck`
- Testes unitários do Garimpo: `npm run test:garimpo --workspace=start-metric`
- Build de produção: `npm run build`

## Protocolo de Trabalho
1. Antes de iniciar qualquer tarefa, leia `execution/CURRENT_TASK.md` e `state/HANDOFF.md`.
2. Siga as regras em `docs/RULES.md` e a arquitetura em `docs/ARCHITECTURE.md`.
3. Não implemente mais de uma Nano Task por vez.
4. Valide sempre com `npm run typecheck` antes de declarar conclusão.
