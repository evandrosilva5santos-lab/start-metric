# 🗺️ Master Roadmap (List of Milestones)

- [ ] **Milestone 1: CORE REFINEMENT (Ready!)**
  - [x] Initialized Monorepo structure (Turborepo)
  - [x] Defined Core Prisma Schema (`packages/db`)
  - [ ] Dashboard UI Prototyping (Shadcn/UI + Lucide)
- [ ] **Milestone 2: BACKEND & INTEGRATIONS**
  - [ ] NestJS API Boilerplate (`apps/api`)
  - [ ] Meta Ads API Connector (Auth / Tokens)
  - [ ] Meta Pixel Ingest Service (Beacon/Pixel endpoint)
- [ ] **Milestone 3: DATA VISUALIZATION**
  - [ ] Real-time Dashboard Charts (Recharts / Tremor)
  - [ ] Lead Tracking Feed (Aggregated UTMS)
  - [ ] Conversion Attribution (FBC / FBP matching)
- [ ] **Milestone 4: AUTOMATION & SCALING**
  - [ ] Automated Reporting (Export PDF/XLS)
  - [ ] Multi-tenant Support (Agency / Client structure)
- [ ] **Milestone 5: DEPLOYMENT**
  - [ ] Vercel / Dockerize API
  - [ ] Final Security Scan & UX Audit

---

# 🧭 Current Trajectory (The active step)
**Step 1.1:** Core Architecture & Socratic Gate.
We are refining the DB schema and preparing the UI framework.

---

# 👥 Squad Status (Table: Agent | Task | Status)
| Agent | Task | Status |
| :--- | :--- | :--- |
| **@orchestrator** | Coordination & Git Flow | ACTIVE |
| **@project-planner** | Roadmap Maintenance | ACTIVE |
| **@frontend-specialist** | Dashboard Design | STANDBY |
| **@backend-specialist** | API & Prisma Management | ACTIVE |

---

# 🛑 Socratic Gate (Need Answers)
1. **Público**: O software é para Gestores solo ou Agências (modelo Agência/Clientes)?
2. **Foco**: Priorizamos Integração API Meta (buscar dados de anúncios) ou Pixel de Rastreamento (captura de cliques/leads)?
3. **Infra**: Preferência por Supabase ou Postgres puro? (O 'padrão da casa' é Supabase).
