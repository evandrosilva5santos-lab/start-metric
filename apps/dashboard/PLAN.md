# Start Metric - Dashboard de Performance

Dashboard de performance de tráfego pago com foco em ROI, tempo e organização.

## 🗺️ Master Roadmap

- [ ] **Milestone 1: Fundação & Design System**
  - Configurar Shadcn/ui (se não estiver pronto)
  - Implementar Layout Base (Sidebar, Header, Perfil)
  - Definir Design Tokens (Cores Dark Premium, Tipografia Inter/Outfit)
- [ ] **Milestone 2: Conectividade & Auth**
  - Validar fluxo de autenticação multi-tenant
  - Implementar tela de conexão com Meta Ads (act_ accounts)
  - Feedback visual de status de sincronização
- [ ] **Milestone 3: Core Dashboard UI**
  - Cards de Métricas Principais (ROAS, Spend, Conversions, CPA)
  - Gráficos de Tendência (Area chart para Spend vs Revenue)
  - Tabela de Campanhas com filtros de status e busca
- [ ] **Milestone 4: Performance & Polimento**
  - Otimização de queries Supabase (índices já existem)
  - Micro-animações com Framer Motion
  - Visualização Mobile Responsiva

## 🧭 Current Trajectory

**Step 1: Auditoria da Fundação de Design e Layout Base**
Estamos na fase de análise e preparação do layout para suportar os dados reais do Supabase.

## 👥 Squad Status

| Agent | Task | Status |
| :--- | :--- | :--- |
| @frontend-specialist | Design System & Layout | 🏗️ Iniciando |
| @backend-specialist | Supabase Integration & RLS | 🔍 Validando |
| @orchestrator | Coordination | 🟢 Ativo |

---

## 🛠️ Próximos Passos Imediatos (Checklist)

1. [ ] Verificar instalação do `shadcn/ui` e componentes base.
2. [ ] Criar Layout Responsivo com Sidebar persistente.
3. [ ] Implementar as Queries dinâmicas no `page.tsx` usando as tabelas `daily_metrics` e `campaigns`.
4. [ ] Adicionar estados de Loading (Skeletongs) premium.
