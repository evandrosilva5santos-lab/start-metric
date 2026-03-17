# SPRINT 1 — CLIENT MANAGEMENT (Menu Cliente)

**Duração estimada:** 1 semana
**Prioridade:** 🔴 CRÍTICO
**Dependências:** Sprint 0 concluído
**Responsável sugerido:** @dev + @data-engineer

---

## O que é este sprint?

Criar o conceito de "Cliente" dentro da plataforma. Um gestor (org) gerencia múltiplos clientes. Cada cliente pode ter uma ou mais contas de anúncio associadas. O painel filtra dados por cliente selecionado.

Hoje não existe tabela `clients`. As ad_accounts estão soltas na org sem segmentação por cliente final.

---

## Contexto atual

| Item | Status |
|------|--------|
| Tabela `clients` | Não existe |
| `ad_accounts.client_id` | Não existe |
| Página /clients | Não existe |
| Filtro por cliente no dashboard | Não existe |
| Sidebar link "Clientes" | Não existe |

---

## Etapas de execução

### S1.1 — Migration: criar tabela `clients`
- id UUID PK, org_id UUID FK, name, email, phone, whatsapp, logo_url, notes, archived_at, created_at, updated_at
- RLS: isolamento por org_id via `get_user_org_id()`
- Índices em org_id, archived_at

### S1.2 — Migration: adicionar `client_id` em `ad_accounts`
- `client_id UUID REFERENCES clients(id) ON DELETE SET NULL`
- Campo nullable (uma conta pode não ter cliente associado)
- Índice em client_id

### S1.3 — API Routes CRUD de clientes
- `GET /api/clients` — listar (com count de ad_accounts)
- `POST /api/clients` — criar
- `GET /api/clients/[id]` — detalhe + ad_accounts vinculadas
- `PATCH /api/clients/[id]` — editar
- `DELETE /api/clients/[id]` — arquivar (soft delete via archived_at)
- `POST /api/clients/[id]/accounts` — associar ad_account
- `DELETE /api/clients/[id]/accounts/[accountId]` — desassociar

### S1.4 — UI: página `/clients`
- Grid de cards de clientes
- Card: logo/avatar, nome, email, phone, badge nº de contas
- Botão "+ Novo Cliente"
- Estado vazio com CTA
- Loading skeleton

### S1.5 — UI: modal de criar/editar cliente
- Campos: Nome*, Email, Telefone, WhatsApp, Notas
- Upload de logo (opcional)
- Multi-select de ad_accounts para associar
- Validação Zod + submit com loading

### S1.6 — UI: associar conta de anúncio ao cliente
- Na página `/settings/meta` ou `/clients/[id]`: select de cliente por ad_account
- Ou: na página do cliente, lista de contas com botão "Adicionar conta"

### S1.7 — Dashboard: filtro por cliente
- Dropdown "Todos os clientes / [Nome do cliente]" nos filtros do dashboard
- Ao selecionar cliente: filtrar campanhas apenas das contas desse cliente
- Persistir seleção no estado (Zustand ou query param)

### S1.8 — Sidebar: link "Clientes"
- Adicionar item "Clientes" no menu lateral com ícone Users
- Rota: `/clients`

---

## Critérios de aceite

- [ ] Tabela `clients` existe com RLS funcionando
- [ ] `ad_accounts` tem campo `client_id` funcional
- [ ] Gestor consegue criar, editar e arquivar clientes
- [ ] Gestor consegue associar contas de anúncio a um cliente
- [ ] Dashboard tem filtro por cliente funcionando
- [ ] Sidebar tem link para /clients

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| Migration SQL nova | CRIAR |
| `apps/dashboard/src/app/(dashboard)/clients/page.tsx` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/clients/ClientsPageClient.tsx` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/clients/[id]/page.tsx` | CRIAR |
| `apps/dashboard/src/app/api/clients/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/clients/[id]/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/clients/[id]/accounts/route.ts` | CRIAR |
| `apps/dashboard/src/components/clients/ClientModal.tsx` | CRIAR |
| `apps/dashboard/src/components/layout/Sidebar.tsx` | MODIFICAR |
| `apps/dashboard/src/components/dashboard/DashboardFilters.tsx` | MODIFICAR |

---

---

# PROMPTS

---

## PROMPT ESQUELETO — Contexto geral para qualquer IA

```
Você está trabalhando em um SaaS de gestão de tráfego pago chamado Start Metric.

STACK:
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- Auth/DB: Supabase (PostgreSQL com RLS)
- Estado: Zustand, TanStack Query
- Animações: Framer Motion | Ícones: Lucide React | Validação: Zod

TEMA VISUAL (seguir rigorosamente):
- Background: bg-slate-950
- Cards: bg-slate-900/50 border border-slate-800 rounded-2xl
- Accent: cyan-400 | Erro: red-400/500 | Sucesso: emerald-400/500
- Labels: text-xs font-semibold text-slate-400 uppercase tracking-widest
- Inputs: px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30
- Botão primário: bg-cyan-400 text-slate-950 font-bold rounded-xl

BANCO ATUAL (tabelas relevantes):
- organizations (id, name)
- profiles (id, org_id, name, phone, role)
- ad_accounts (id, org_id, external_id, platform, name, token_encrypted, status)
- campaigns (id, org_id, ad_account_id, name, status, spend, roas)
- daily_metrics (id, org_id, campaign_id, date, spend, revenue_attributed, roas)

FUNÇÃO RLS disponível: get_user_org_id() → retorna org_id do usuário autenticado

NOVA TAREFA — SPRINT 1: Client Management
Adicionar o conceito de "cliente" (cliente final do gestor de tráfego).
Um gestor tem uma org. Dentro da org, ele atende múltiplos clientes.
Cada cliente pode ter uma ou mais ad_accounts associadas.
O dashboard deve poder filtrar dados por cliente.

NOVO MODELO:
clients (id, org_id, name, email, phone, whatsapp, logo_url, notes, archived_at, timestamps)
ad_accounts + client_id FK → clients (nullable)

PADRÕES:
- API Routes: /app/api/**/route.ts
- Resposta: { data, error }
- Validação: Zod em todos os endpoints
- RLS: todos os dados isolados por org_id
- Idioma: português brasileiro em textos visíveis
```

---

## PROMPT FRONTEND — Módulo de Clientes

```
Você é um engenheiro frontend sênior. Crie o módulo de gerenciamento de clientes para um SaaS de tráfego pago.

ARQUIVOS A CRIAR:

=== 1. apps/dashboard/src/app/(dashboard)/clients/page.tsx ===
Server Component. Verificar autenticação. Renderizar <ClientsPageClient />.

=== 2. apps/dashboard/src/app/(dashboard)/clients/ClientsPageClient.tsx ===
"use client"

Estados:
- Lista de clientes (GET /api/clients)
- Modal aberto (criar/editar)
- Loading, erro

LAYOUT DA PÁGINA:
- Header: título "Clientes" + botão "+ Novo Cliente" (cyan, ícone Plus)
- Grid 3 colunas desktop / 1 mobile com gap-4

CARD DE CLIENTE (ClientCard):
- Avatar: círculo 48px com logo ou iniciais do nome em bg-cyan-400/20 text-cyan-400
- Nome: font-semibold text-white
- Email e telefone: text-sm text-slate-400 com ícones Mail e Phone
- Badge: "X contas vinculadas" — bg-slate-800 text-slate-400 rounded-full px-2 py-0.5 text-xs
- Rodapé do card: botões ação — "Ver métricas" (outline cyan), "Editar" (ghost), "Arquivar" (ghost vermelho)
- Hover: border-cyan-400/30 transition-all shadow-lg shadow-cyan-400/5

ESTADO VAZIO (sem clientes):
- Ícone Users grande em text-slate-700
- Título: "Nenhum cliente ainda"
- Subtítulo: "Crie seu primeiro cliente para organizar as contas de anúncio"
- Botão "+ Criar primeiro cliente"

LOADING:
- Skeleton: 3 cards placeholder com animate-pulse bg-slate-800 rounded-2xl h-40

=== 3. apps/dashboard/src/components/clients/ClientModal.tsx ===
"use client"
Props: isOpen, onClose, client? (para edição), onSaved

Modal com Framer Motion (AnimatePresence + scale 0.95→1, opacity 0→1).
Overlay: fixed inset-0 bg-black/60 backdrop-blur-sm z-50.
Container: bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-6 max-w-lg w-full mx-4.

CAMPOS:
- Nome* (input)
- E-mail (input email)
- Telefone (input tel)
- WhatsApp (input tel, placeholder "+55 11 99999-9999")
- Notas (textarea, 3 linhas, optional)
- Ad Accounts (multi-select: buscar GET /api/meta/accounts, chips selecionáveis)

Ad Accounts multi-select:
- Lista de contas disponíveis como chips clicáveis
- Selecionados: bg-cyan-400/10 border-cyan-400/30 text-cyan-400
- Não selecionados: bg-slate-800 border-slate-700 text-slate-400

Validação Zod:
- nome: z.string().min(2, "Nome muito curto")
- email: z.string().email().optional().or(z.literal(""))
- telefone/whatsapp: z.string().optional()

Botões: "Cancelar" (ghost) + "Salvar cliente" (cyan, loading state)

=== 4. Modificar Sidebar.tsx ===
Adicionar item no menu:
{ href: "/clients", icon: Users, label: "Clientes" }
Posicionar após "Performance" e antes de "Contas".

=== 5. Modificar DashboardFilters.tsx ===
Adicionar select "Cliente":
- Opção padrão: "Todos os clientes"
- Buscar clientes via GET /api/clients
- Ao selecionar: propagar client_id para os filtros do dashboard
- Ícone: Building2

TYPESCRIPT: Interfaces tipadas. Sem `any`. "use client" onde necessário.
IDIOMA: Português brasileiro em todos os textos.
```

---

## PROMPT BACKEND — Migration + API Routes

```
Você é um engenheiro backend sênior especialista em PostgreSQL, Supabase e Next.js App Router.

PARTE 1 — MIGRATION SQL

-- Tabela clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  logo_url TEXT,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own_org" ON public.clients
  FOR SELECT USING (org_id = public.get_user_org_id());

CREATE POLICY "clients_insert_own_org" ON public.clients
  FOR INSERT WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "clients_update_own_org" ON public.clients
  FOR UPDATE USING (org_id = public.get_user_org_id());

CREATE POLICY "clients_delete_own_org" ON public.clients
  FOR DELETE USING (org_id = public.get_user_org_id());

-- Trigger updated_at
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_archived_at ON public.clients(archived_at)
  WHERE archived_at IS NULL;

-- Adicionar client_id em ad_accounts
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ad_accounts_client_id ON public.ad_accounts(client_id);


PARTE 2 — API ROUTES (Next.js App Router)

Crie os seguintes arquivos:

=== apps/dashboard/src/app/api/clients/route.ts ===

Schema Zod para criação:
{
  name: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  logo_url: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
  account_ids: z.array(z.string().uuid()).optional() // contas para associar
}

GET /api/clients:
- Buscar todos clients da org WHERE archived_at IS NULL
- Incluir contagem de ad_accounts: SELECT c.*, COUNT(a.id) as accounts_count FROM clients c LEFT JOIN ad_accounts a ON a.client_id = c.id GROUP BY c.id
- Ordenar por created_at DESC
- Retornar: { data: Client[] }

POST /api/clients:
- Validar body com Zod
- Inserir client (org_id = get_user_org_id())
- Se account_ids fornecidos: UPDATE ad_accounts SET client_id = novo_id WHERE id IN (account_ids) AND org_id = org_id
- Retornar: { data: client_criado }

=== apps/dashboard/src/app/api/clients/[id]/route.ts ===

GET /api/clients/[id]:
- Buscar client por id WHERE org_id = get_user_org_id()
- Incluir ad_accounts associadas
- 404 se não encontrado ou não pertence à org

PATCH /api/clients/[id]:
- Validar body (mesma schema mas todos opcionais)
- UPDATE apenas campos fornecidos
- Retornar: { data: client_atualizado }

DELETE /api/clients/[id]:
- Soft delete: UPDATE clients SET archived_at = now() WHERE id = $id AND org_id = org_id
- Retornar: { data: { archived: true } }

=== apps/dashboard/src/app/api/clients/[id]/accounts/route.ts ===

POST: associar ad_account ao client
Body: { account_id: UUID }
- Verificar que account pertence à mesma org
- UPDATE ad_accounts SET client_id = $client_id WHERE id = $account_id AND org_id = org_id

DELETE /api/clients/[id]/accounts/[accountId]:
- UPDATE ad_accounts SET client_id = NULL WHERE id = $accountId AND org_id = org_id

PADRÕES:
- createClient() de @/lib/supabase/server
- Verificar autenticação em todo endpoint
- TypeScript strict, sem `any`
- Resposta de erro: { error: "mensagem" } com status HTTP correto
- Nunca expor dados de outra org
```
