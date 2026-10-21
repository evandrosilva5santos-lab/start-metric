# CURRENT_TASK.md — Proposta de Autorização Operacional

> Este arquivo é uma proposta. Ele **não substitui** `execution/CURRENT_TASK.md` e não concede autorização de execução.

```text
STATUS:
PROPOSED

PREPARATION:
COMPLETE

CURRENT AGENT:
UNASSIGNED

PREPARATION AGENT:
CODEX

EXECUTION AUTHORIZED:
NO

AUTHORIZED NANO TASK:
NANO-009.00.01

RISK LEVEL:
LOW

PREDECESSOR GATE:
NANO-005.02.01 DONE OU ADIAMENTO FORMAL PELO PROPRIETÁRIO
```

---

## Especificação da nano task proposta: `NANO-009.00.01`

- **Título:** Canonizar o Design System Metrifiquei Teal no START METRIC
- **Origem:** decisão do proprietário registrada em 17/10/2026 e `docs/METRIFIQUEI_DESIGN_SYSTEM_MIGRATION.md`
- **Objetivo:** declarar o Metrifiquei Teal como contrato visual oficial, marcar Dark Obsidian/Emerald e Start Control azul como direções históricas e preparar a fila sequencial de migração.
- **Natureza:** documentação e governança; nenhuma mudança de frontend, CSS, dependência ou regra de negócio.

## Checklist ECC

1. **PLAN:** confirmar que a tarefa anterior foi concluída ou formalmente adiada e registrar o snapshot do worktree.
2. **RESEARCH:** reler `AGENTS.md`, os 11 documentos obrigatórios e a especificação de migração.
3. **CONTRACT:** atualizar `docs/DESIGN.md` com tokens, tipografia, temas, estados, responsividade e acessibilidade canônicos.
4. **DECISION:** registrar em `docs/DECISIONS.md` a substituição das duas direções anteriores, sem apagar o histórico.
5. **RULES:** atualizar somente as regras necessárias para tornar o contrato inequívoco.
6. **DEPRECATION:** marcar `design/DIRECAO_START_CONTROL.md` como histórico/substituído, mantendo seu conteúdo consultável.
7. **QUEUE:** cadastrar as nano tasks na ordem definida, sem autorizar execução paralela.
8. **VERIFY:** validar referências, `git diff --check` e ausência de diff em código, CSS, manifests e lockfile.
9. **DOCUMENT:** atualizar changelog, status e handoff conforme ECC.

## ALLOWED FILES

- `docs/DESIGN.md`
- `docs/RULES.md`
- `docs/DECISIONS.md`
- `docs/METRIFIQUEI_DESIGN_SYSTEM_MIGRATION.md`
- `design/DIRECAO_START_CONTROL.md`
- `execution/TASK_QUEUE.md`
- `state/CHANGELOG.md`
- `state/STATUS.md`
- `state/HANDOFF.md`

## FORBIDDEN FILES

- `execution/CURRENT_TASK.md` durante a execução (a autorização deve ser aplicada antes do início)
- `AGENTS.md`
- `PRD.md`
- `apps/**`
- `packages/**`
- `supabase/**`
- `e2e/**`
- `public/**`
- `package.json`
- `package-lock.json`
- `apps/dashboard/package.json`
- `apps/dashboard/components.json`
- `.env*`
- Qualquer arquivo não listado expressamente em **ALLOWED FILES**

## Critérios de aceite

- Metrifiquei Teal é a única direção visual vigente nos documentos canônicos.
- Dark Obsidian/Emerald e Start Control azul permanecem acessíveis como histórico, mas não normativos.
- Inter, JetBrains Mono, temas claro/escuro, WCAG AA, 1440/834/390 e estados Empty/Loading/Error/Success estão especificados.
- A estratégia de compatibilidade impede remoção de componentes antes do mapa de consumidores chegar a zero.
- A fila contém uma única sequência de nano tasks, sem tarefas visuais paralelas.
- Nenhum arquivo de código, CSS, dependência, banco ou configuração foi alterado.
- `git diff --check` aprovado e referências locais válidas.

## Comandos de verificação propostos

```bash
git diff --check -- docs design execution state
git diff --name-only -- apps packages supabase e2e public package.json package-lock.json
rg -n "Metrifiquei|Dark Obsidian|Start Control|Inter|JetBrains Mono|1440|834|390|WCAG" docs/DESIGN.md docs/DECISIONS.md docs/RULES.md design/DIRECAO_START_CONTROL.md
```

## Regra de autorização

Para iniciar, o proprietário ou o agente de governança deve substituir formalmente `execution/CURRENT_TASK.md` por uma autorização com `EXECUTION AUTHORIZED: YES`. A existência desta proposta não permite nenhuma implementação.
