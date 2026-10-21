# CURRENT_TASK.md — Validação Integrada de Autorização

```text
TASK ID: NANO-010.05.01
STATUS: IN_PROGRESS
OWNER AUTHORIZATION: 17/10/2026
RISK: MEDIUM
```

## Objetivo atômico

Validar a regra canônica ponta a ponta, sem mutar dados reais, e registrar evidências técnicas e de navegador.

## ALLOWED FILES

- `apps/dashboard/package.json`
- `package.json`
- `state/CHANGELOG.md`
- `state/STATUS.md`
- `state/HANDOFF.md`
- `execution/CURRENT_TASK.md`
- `execution/TASK_QUEUE.md`
- `docs/PRD_ISSUES.md` (somente se houver bloqueio real)

## FORBIDDEN FILES

- Código funcional, UI, CSS, APIs, migrations e schemas
- Dados remotos e variáveis `.env*`

## Validações obrigatórias

- Typecheck e lint sem erros.
- Garimpo, Relatórios, Alertas, Meta action map, autorização e API aprovados.
- Build de produção aprovado.
- Chrome real: autenticação, inventário operacional, hierarquia e ausência de “Sem cliente”.
- Viewports 1440, 834 e 390; console sem erro e sem overflow global.
- Nenhuma ação de salvar, mover, desvincular, arquivar ou reconectar em dados reais.

