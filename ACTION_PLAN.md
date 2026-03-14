# 🚀 Plano de Ação: MVP Tracking & Gestão de Ads

Este plano detalha as etapas de implementação baseadas no `PRD.md` e `PROMPT_CLAUDE.md`.

## 📌 Status Legenda
- ⭕ **PENDENTE**: Aguardando início.
- 🟡 **EM ANDAMENTO**: Implementação ativa.
- ✅ **VALIDADO**: Código testado e funcional.

---

## 🛠️ Fase 1: Backend Infrastructure (NestJS + Prisma)
*Focada em conectar a API ao Supabase e preparar o motor de dados.*

### Etapas:
1. [ ] **Setup Prisma Core** ⭕
   - [ ] Iniciar Prisma em `apps/api`.
   - [ ] Configurar chaves de acesso no `.env` (API).
   - [ ] Introspectar banco de dados do Supabase.
2. [ ] **Service & Module Setup** ⭕
   - [ ] Criar `PrismaService` global no NestJS.
   - [ ] Validar conexão com teste de query simples.
3. [ ] **Schema Expansion** ⭕
   - [ ] Adicionar tabelas para `AdsAccounts`, `Campaigns` e `TrackingEvents`.

---

## 📊 Fase 2: Ads Management Core
*Sincronização com Meta Ads (Milestone 2 do Roadmap).*

### Etapas:
1. [ ] **Meta Ads SDK Integration** ⭕
2. [ ] **Background Sync (BullMQ)** ⭕
3. [ ] **Ads Account Syncing Service** ⭕

---

## 📈 Fase 3: Dashboard & Frontend
*Visualização das métricas premium.*

### Etapas:
1. [ ] **API Endpoints para Métricas** ⭕
2. [ ] **Next.js Dashboard Components** ⭕
3. [ ] **Filtros e Visualização de ROI/CPA** ⭕

---

## 📝 Próximos Passos Imediatos:
1. Executar o **Passo 1 da Fase 1** (Prisma Init em `apps/api`).
2. Atualizar o `PROMPT_CLAUDE.md` com o status de progresso.
