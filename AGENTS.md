# AGENTS.md — Contrato Operacional Universal (ECC Powered)

Este repositório opera sob o protocolo de **Orquestração Determinística Spec-First integrado à metodologia Everything Claude Code (ECC)**.

---

## 1. Regra Fundamental Antes de Executar Qualquer Ação

Antes de propor, planejar ou alterar qualquer linha de código, toda IA DEVE obrigatoriamente ler e respeitar:

1. [`PRD.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/PRD.md)
2. [`docs/PROJECT_MAP.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/docs/PROJECT_MAP.md)
3. [`docs/ARCHITECTURE.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/docs/ARCHITECTURE.md)
4. [`docs/DESIGN.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/docs/DESIGN.md)
5. [`docs/RULES.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/docs/RULES.md)
6. [`docs/DECISIONS.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/docs/DECISIONS.md)
7. [`docs/ECC_INTEGRATION.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/docs/ECC_INTEGRATION.md)
8. [`execution/EXECUTION_RULES.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/execution/EXECUTION_RULES.md)
9. [`execution/CURRENT_TASK.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/execution/CURRENT_TASK.md)
10. [`state/STATUS.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/state/STATUS.md)
11. [`state/HANDOFF.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/state/HANDOFF.md)

---

## 2. Ciclo de Engenharia ECC para Cada Nano Task

Toda Nano Task executada deve obedecer ao ciclo canônico:

```text
PLAN ➔ RESEARCH ➔ TEST (TDD) ➔ IMPLEMENT ➔ REVIEW ➔ VERIFY ➔ DOCUMENT ➔ MEMORY ➔ HANDOFF
```

1. **Apenas Uma Nano Task:** Execute exclusivamente a Nano Task autorizada em [`execution/CURRENT_TASK.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/execution/CURRENT_TASK.md).
2. **Research-First:** Investigue padrões e tipos existentes em `@start-metric/*` antes de implementar para evitar redundâncias.
3. **Respeito a Arquivos Permitidos:** Nunca altere arquivos listados em `FORBIDDEN FILES`.
4. **Verificação em 3 Níveis:**
   - *Level 1:* Teste local / unitário.
   - *Level 2:* Integração e `npm run typecheck` sem erros.
   - *Level 3:* Conformidade com o critério de aceite do PRD.
5. **Memória Persistente & Handoff:** Atualize [`state/CHANGELOG.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/state/CHANGELOG.md), [`execution/TASK_QUEUE.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/execution/TASK_QUEUE.md) e gere o próximo [`state/HANDOFF.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/state/HANDOFF.md).
6. **Dúvida / Conflito / Bloqueio:** Pare imediatamente e registre em [`docs/PRD_ISSUES.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/docs/PRD_ISSUES.md) ou [`state/BLOCKERS.md`](file:///Volumes/Vol%20Macbook/App/TRAFEGO%20PAGO/state/BLOCKERS.md).
