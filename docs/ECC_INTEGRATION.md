# ECC_INTEGRATION.md — Integração da Metodologia Everything Claude Code (ECC)

> **Referência Oficial:** `https://github.com/affaan-m/ECC` (Affaan Mustafa)  
> **Propósito:** Definir como os princípios de engenharia, pesquisa prévia (Research-First), TDD, revisão em contexto limpo, governança de segurança, gerenciamento de contexto e memória persistente do ECC são integrados à governança do Start Metric.

---

## 1. Visão Geral da Arquitetura em Duas Camadas

O sistema opera pela união da **Governança de Produto Spec-First** com a **Metodologia de Engenharia ECC**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   CAMADA 1: GOVERNANÇA DO PROJETO                       │
│  PRD ➔ RULES ➔ ARCHITECTURE ➔ DESIGN ➔ DECISIONS ➔ MASTER PLAN ➔ TASKS │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (O QUE FAZER)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CAMADA 2: CICLO DE ENGENHARIA ECC                    │
│ PLAN ➔ RESEARCH ➔ TEST ➔ IMPLEMENT ➔ REVIEW ➔ VERIFY ➔ MEMORY ➔ HANDOFF│
└────────────────────────────────────────────────────────────────────────┘
                                      (COMO EXECUTAR COM MÁXIMA QUALIDADE)
```

---

## 2. Capacidades do ECC Adotadas vs. Não Adotadas

| Capacidade ECC | Status no Projeto | Justificativa / Aplicação Prática |
|---|---|---|
| **Research-First** | `ADOTADO` | Antes de codificar, verificar bibliotecas existentes, decisões anteriores e evitar duplicações. |
| **TDD / Test-First** | `ADOTADO` | Escrever ou mapear o teste antes da implementação quando aplicável (`RED ➔ GREEN ➔ REFACTOR`). |
| **Code Review em Contexto Limpo** | `ADOTADO` | Revisão sistemática pós-implementação avaliando corretude, escopo, segurança e regressão. |
| **Security Review** | `ADOTADO` | Auditoria mandatória em endpoints de pagamento (Stripe), OAuth, tokens da Meta e queries com RLS. |
| **Níveis de Verificação (1, 2 e 3)** | `ADOTADO` | Level 1 (Local), Level 2 (Integração/Build), Level 3 (Requisito do PRD). |
| **Memória Persistente do Projeto** | `ADOTADO` | Promoção de decisões e aprendizados da sessão para `docs/DECISIONS.md`, `docs/RULES.md` e `state/CHANGELOG.md`. |
| **Context Management** | `ADOTADO` | Redução do consumo de tokens carregando apenas os arquivos permitidos (`ALLOWED FILES`) e documentação relevante. |
| **Hooks e Scripts Complexos Desnecessários** | `NÃO ADOTADO` | Evitar sobrecarga burocrática; priorizar scripts npm nativos (`npm run typecheck`, `npm run test:garimpo`). |

---

## 3. O Ciclo de Engenharia de Cada Nano Task

Toda Nano Task executada pelo **Claude Code** deve cumprir rigorosamente as 9 etapas:

```text
1. PLAN: Ler CURRENT_TASK.md, PRD.md, RULES.md, DESIGN.md e ARCHITECTURE.md.
2. RESEARCH: Identificar código reaproveitável, tipos compartilhados e convenções do monorepo.
3. TEST (TDD): Definir casos de teste e critério de falha/sucesso antes de modificar o código.
4. IMPLEMENT: Alterar estritamente os ALLOWED FILES sob tipagem TypeScript Strict e Zod.
5. REVIEW: Inspecionar o código gerado contra injeções, vazamentos, escopo e conformidade com o Design System.
6. VERIFY: Executar validação técnica (npm run typecheck, testes unitários, build checks).
7. DOCUMENT: Registrar alterações em state/CHANGELOG.md e atualizar docs se houver nova decisão.
8. MEMORY: Consolidar aprendizados ou padrões em docs/DECISIONS.md ou docs/RULES.md.
9. HANDOFF: Atualizar state/STATUS.md, execution/TASK_QUEUE.md e preparar o próximo state/HANDOFF.md.
```

---

## 4. Classificação de Risco (Risk-Based Execution)

Cada tarefa do Master Plan é classificada por nível de risco:

* 🟢 **LOW:** Alterações cosméticas ou utilitários puros. Requer `TypeCheck`.
* 🟡 **MEDIUM:** Componentes de interface e hooks com estado. Requer `TypeCheck` + `Review de UX`.
* 🟠 **HIGH:** Endpoints de API, rotas de banco e cálculos de métricas. Requer `Research` + `Testes` + `Review`.
* 🔴 **CRITICAL:** Autenticação, RLS, webhooks de pagamento (Stripe) e tokens de segurança da Meta. Requer `Security Review` + `Verificação em 3 Níveis` + `Validação de RLS`.
