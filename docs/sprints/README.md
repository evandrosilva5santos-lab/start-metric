# SPRINTS — START METRIC

Esta pasta contém os sprints detalhados do projeto Start Metric. Cada sprint é um arquivo markdown independente com todas as instruções necessárias para implementação.

---

## 📋 ÍNDICE DOS SPRINTS

| Sprint | Nome | Duração | Prioridade | Status | Dependências |
|--------|------|---------|-----------|--------|--------------|
| [Sprint 0](./sprint-0-fundacao.md) | Fundação e Perfil do Usuário | 3–5 dias | 🔴 CRÍTICO | ⏸️ Pendente | Nenhuma |
| [Sprint 1](./sprint-1-client-management.md) | Client Management (Menu Cliente) | 1 semana | 🔴 CRÍTICO | ⏸️ Pendente | Sprint 0 |
| [Sprint 2](./sprint-2-meta-real.md) | Meta API Dados Reais + ROAS Real | 1–2 semanas | 🔴 CRÍTICO | ⏸️ Pendente | Sprint 1 |
| [Sprint 3](./sprint-3-analytics-engine.md) | Analytics Engine (Filtros Avançados) | 1 semana | 🟠 ALTO | ⏸️ Pendente | Sprint 2 |
| [Sprint 4](./sprint-4-whatsapp-connection.md) | WhatsApp Connection | 2 semanas | 🟠 ALTO | ⏸️ Pendente | Sprint 1 |
| [Sprint 5](./sprint-5-report-templates.md) | Report Templates | 1–2 semanas | 🟠 ALTO | ⏸️ Pendente | Sprint 2 |
| [Sprint 6](./sprint-6-whatsapp-notificacoes.md) | WhatsApp Notificações (Agendamento) | 1 semana | 🟡 MÉDIO | ⏸️ Pendente | Sprint 4 + 5 |

**Total estimado:** 8–12 semanas para completar todos os sprints

---

## 📖 COMO USAR ESTES ARQUIVOS

### Para implementar um sprint

1. **Leia o arquivo completo do sprint**
   - Cada sprint tem: descrição, contexto, etapas, critérios de aceite e prompts

2. **Siga as etapas em ordem**
   - As etapas dentro de cada sprint são sequenciais
   - Complete uma etapa antes de ir para a próxima

3. **Use os prompts fornecidos**
   - Cada sprint tem 3 prompts no final:
     - **PROMPT ESQUELETO** — contexto geral para qualquer IA
     - **PROMPT FRONTEND** — instruções específicas para dev frontend
     - **PROMPT BACKEND** — instruções específicas para dev backend

4. **Implemente seguindo o prompt**
   - Copie e cole o prompt em uma IA (Claude, ChatGPT, etc.)
   - A IA gerará o código seguindo os padrões do projeto

5. **Teste e valide**
   - Siga os critérios de aceite listados no sprint
   - Marque cada item como concluído quando testado

6. **Marque o sprint como completo**
   - Quando todos os critérios de aceite estiverem OK, comunique ao @dev-lead
   - O sprint será marcado como ✅ COMPLETO

---

## 🔄 CICLO DE VIDA DOS ARQUIVOS DE SPRINT

### STATUS DE UM SPRINT

| Status | Descrição | Ação |
|--------|-----------|------|
| ⏸️ **Pendente** | Sprint ainda não iniciado | Pode iniciar a qualquer momento |
| 🚧 **Em Andamento** | Sprint em desenvolvimento | Implementação em curso |
| ✅ **Completo** | Sprint finalizado e testado | **Arquivo pode ser excluído** |

### REGRA DE LIMPEZA

> **IMPORTANTE:** Após completar e testar um sprint, e após confirmar que tudo está funcionando corretamente, **EXCLUA o arquivo .md correspondente** para não pesar o projeto.

**Por que excluir?**
- Arquivos de sprint são temporários — são guias de implementação, não documentação permanente
- Após a implementação, o código é a verdade — os arquivos de sprint se tornam obsoletos
- Manter arquivos antigos polui o repositório e confunde novos desenvolvedores

**O que NÃO excluir:**
- `README.md` (este arquivo) — mantém o índice e histórico
- Documentação em `docs/architecture/` — essa é permanente
- Migration SQL — essas ficam no banco, não deletar

**Processo de exclusão:**
1. Implementar o sprint completo
2. Testar todos os critérios de aceite
3. Comunicar ao @dev-lead: "Sprint X está completo e testado"
4. Aguardar confirmação: "Pode excluir o arquivo"
5. Deletar o arquivo `.md` do sprint
6. Atualizar o status no `README.md` para ✅

---

## 📂 ESTRUTURA DE UM ARQUIVO DE SPRINT

Cada arquivo de sprint segue esta estrutura:

```markdown
# SPRINT X — NOME DO SPRINT

**Duração estimada:** X dias/semanas
**Prioridade:** 🔴🟠🟡
**Dependências:** Sprint(s) anteriores necessários
**Responsável sugerido:** @role

---

## O que é este sprint?
[Descrição sucinta do objetivo]

---

## Contexto atual
[Tabela com status atual dos itens relevantes]

---

## Etapas de execução
[SX.1, SX.2, etc. — passo a passo detalhado]

---

## Critérios de aceite
[Lista de checkables para validar implementação]

---

## Arquivos que serão criados/modificados
[Tabela com arquivos e ação: CRIAR/MODIFICAR]

---

# PROMPTS

---

## PROMPT ESQUELETO
[Contexto geral para qualquer IA]

---

## PROMPT FRONTEND
[Instruções específicas para dev frontend]

---

## PROMPT BACKEND
[Instruções específicas para dev backend]
```

---

## 🎯 ORDEM RECOMENDADA DE EXECUÇÃO

### FASE 1 — FUNDAÇÃO (Sprints 0–1)
**Objetivo:** Corrigir blockers + estrutura básica de clientes
- Sprint 0: Auth fix + perfil usuário
- Sprint 1: Client management

### FASE 2 — DADOS REAIS (Sprints 2–3)
**Objetivo:** Dados Meta + analytics completo
- Sprint 2: Meta API dados reais
- Sprint 3: Analytics Engine

### FASE 3 — AUTOMAÇÃO (Sprints 4–6)
**Objetivo:** WhatsApp + relatórios automáticos
- Sprint 4: WhatsApp connection
- Sprint 5: Report templates
- Sprint 6: Notificações agendadas

**Sprints podem ser feitos em paralelo** quando não há dependência direta:
- Sprints 2 e 4 são independentes → podem ser feitos juntos
- Sprints 3 depende do 2 → fazer na sequência
- Sprint 6 depende de 4 e 5 → fazer depois desses

---

## 🔗 DOCUMENTAÇÃO RELACIONADA

- `[PRD.md](../../PRD.md)` — Product Requirements Document (fonte da verdade)
- `[GO_LIVE_BASIC.md](../../apps/dashboard/GO_LIVE_BASIC.md)` — Guia de deploy
- `[docs/stories/](../stories/)` — Stories de desenvolvimento já completadas

---

## 💡 DICAS DE USO

### Para DEV FRONTEND
- Use o **PROMPT FRONTEND** de cada sprint
- Siga rigorosamente o design system descrito (slate-950 bg, cyan accent, glassmorphism)
- Use Framer Motion para animações (entradas, transições)
- Mantenha todos os textos em português brasileiro

### Para DEV BACKEND
- Use o **PROMPT BACKEND** de cada sprint
- Sempre valide com Zod em todos os endpoints
- Use `createClient()` de `@/lib/supabase/server`
- Nunca exponha service role key no client
- RLS deve estar ativo em todas as tabelas públicas

### Para QA
- Use os **Critérios de Aceite** como checklist de testes
- Teste cada criterium antes de marcar como OK
- Reporte bugs encontrados durante os testes
- Valide RLS: tente acessar dados de outra org (deve falhar)

---

## 📞 SUPORTE

Em caso de dúvidas durante a implementação de um sprint:
1. Verifique se a pergunta já está respondida no PRD
2. Consulte o `docs/architecture/` se houver
3. Pergunte ao @dev-lead ou @architect

---

**Última atualização:** 2026-03-16
**Versão:** 1.0
