# EXECUTION_RULES.md — Protocolo de Execução do Claude Code (ECC Powered)

> **Regra Suprema de Operação:** Toda execução autorizada segue obrigatoriamente o ciclo de engenharia ECC. Uma execução = Uma única Nano Task autorizada.

---

## 1. Ciclo de Execução ECC em 9 Etapas

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. PLAN:                                                               │
│    - Ler CURRENT_TASK.md para identificar a Nano Task autorizada.     │
│    - Ler PRD.md, docs/RULES.md, docs/DESIGN.md e docs/ARCHITECTURE.md.│
│                                                                        │
│ 2. RESEARCH:                                                           │
│    - Investigar se já existem tipos em @start-metric/types.           │
│    - Identificar utilitários ou schemas correlatos no monorepo.        │
│    - Responder às RESEARCH QUESTIONS da Nano Task.                     │
│                                                                        │
│ 3. TEST (TDD):                                                         │
│    - Definir casos de teste (RED) antes da implementação de código.    │
│                                                                        │
│ 4. IMPLEMENT:                                                          │
│    - Alterar estritamente os ALLOWED FILES.                           │
│    - TypeScript Strict + Zod. Se tocar em FORBIDDEN FILE: PARAR.       │
│                                                                        │
│ 5. REVIEW:                                                             │
│    - Revisar o código como um auditor externo (Security, Performance,  │
│      Design System, Regressão, Memory Leaks).                          │
│                                                                        │
│ 6. VERIFY:                                                             │
│    - Level 1: Testes locais / unitários passam.                        │
│    - Level 2: npm run typecheck passa com 0 erros.                     │
│    - Level 3: Requisito do PRD é integralmente atendido.               │
│                                                                        │
│ 7. DOCUMENT:                                                           │
│    - Atualizar state/CHANGELOG.md com arquivos alterados e resultado.  │
│                                                                        │
│ 8. MEMORY:                                                             │
│    - Promover aprendizados duráveis para docs/DECISIONS.md ou RULES.md.│
│                                                                        │
│ 9. HANDOFF:                                                            │
│    - Mover Nano Task para DONE em execution/TASK_QUEUE.md.             │
│    - Atualizar state/STATUS.md e gerar o próximo state/HANDOFF.md.     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Diante de Dúvidas, Ambiguidade ou Erro Inesperado

```text
STOP
  ↓
DOCUMENT (Registrar em docs/PRD_ISSUES.md ou state/BLOCKERS.md)
  ↓
CLASSIFY (AMBIGUITY / CONFLICT / BLOCKER / SECURITY_RISK)
  ↓
BLOCK (Não inventar soluções convenientes ou alterar escopo silenciosamente)
```
