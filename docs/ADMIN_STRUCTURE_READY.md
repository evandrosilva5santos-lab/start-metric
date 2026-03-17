# Admin Panel — Estrutura Preparada

**Data:** 2026-03-17
**Status:** Planejamento (implementação em Sprint 6)

---

## 🎯 Objetivo

Criar uma **camada admin completamente separada** da user dashboard:
- Login diferente
- Rotas isoladas
- Database queries sem RLS
- Visual próprio

---

## 📂 ESTRUTURA DE DIRETÓRIOS (PREPARADA)

```
apps/dashboard/src/
├── app/
│   ├── (dashboard)/              ← USER DASHBOARD
│   │   ├── layout.tsx            ← Layout com sidebar
│   │   ├── page.tsx              ← /dashboard (home)
│   │   ├── clients/
│   │   ├── settings/
│   │   └── reports/
│   │
│   ├── admin/                    ← ADMIN PANEL (SEPARADO)
│   │   ├── layout.tsx            ← Layout admin próprio
│   │   ├── login/                ← /admin/login
│   │   │   └── page.tsx
│   │   ├── dashboard/            ← /admin/dashboard
│   │   │   └── page.tsx          ← Home do admin
│   │   ├── users/                ← /admin/users
│   │   │   └── page.tsx          ← Gestão de usuários
│   │   ├── plans/                ← /admin/plans
│   │   │   └── page.tsx          ← Gestão de planos
│   │   ├── payments/             ← /admin/payments
│   │   │   └── page.tsx          ← Histórico de pagamentos
│   │   ├── analytics/            ← /admin/analytics
│   │   │   └── page.tsx          ← Métricas globais
│   │   └── logs/                 ← /admin/logs
│   │       └── page.tsx          ← Auditoria
│   │
│   ├── api/
│   │   ├── admin/                ← APIs ADMIN
│   │   │   ├── users/
│   │   │   ├── plans/
│   │   │   ├── payments/
│   │   │   ├── analytics/
│   │   │   └── logs/
│   │   ├── shared/               ← APIs CLIENT PORTAL
│   │   │   ├── generate-token/
│   │   │   └── validate/
│   │   └── ...                   ← Demais APIs (user)
│   │
│   ├── shared/                   ← CLIENT PORTAL
│   │   ├── dashboard/
│   │   ├── auth/
│   │   └── report/
│   │
│   └── auth/                     ← AUTH USER
│       └── ...
│
└── lib/
    └── admin/                    ← Helpers do admin
        ├── permissions.ts        ← Verificar se é admin
        ├── analytics.ts          ← Cálculos de metrics
        └── stripe.ts             ← Integração Stripe
```

---

## 🔐 PROTEÇÃO DO ADMIN

### Middleware de Autenticação Admin

**Arquivo:** `apps/dashboard/src/lib/admin/permissions.ts`

```typescript
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Não autenticado");
  }

  // Buscar perfil do usuário
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Perfil não encontrado");
  }

  // Verificar se é admin
  const isAdmin = profile.role === "admin";

  if (!isAdmin) {
    throw new Error("Acesso negado: requer role admin");
  }

  return { user, profile };
}

export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
```

### Layout Admin com Verificação

**Arquivo:** `apps/dashboard/src/app/admin/layout.tsx`

```typescript
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/permissions";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    // Verificar se é admin antes de renderizar
    const { user } = await requireAdmin();

    return (
      <div className="flex h-screen bg-slate-950">
        {/* Sidebar admin */}
        <AdminSidebar />

        {/* Conteúdo */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    );
  } catch (error) {
    // Não é admin → redireciona para login
    redirect("/admin/login");
  }
}
```

---

## 📊 ROTAS ADMIN (ESTRUTURA)

### 1. `/admin/login` — Login Diferenciado

```typescript
// apps/dashboard/src/app/admin/login/page.tsx

"use client";

// Formulário com:
// - Email
// - Senha
// - Button: "Entrar como Admin"
//
// Só permite email = evandro@startinc.com.br (ou hardcoded)
// Redireciona para /admin/dashboard após login
```

### 2. `/admin/dashboard` — Home do Admin

```typescript
// apps/dashboard/src/app/admin/dashboard/page.tsx

// Mostra cards com:
// - Total de usuários
// - MRR (receita recorrente)
// - Churn (taxa de cancelamento)
// - Uptime da API
// - Relatórios enviados (volume)
// - Taxa de sucesso de sincronização Meta
```

### 3. `/admin/users` — Gestão de Usuários

```typescript
// apps/dashboard/src/app/admin/users/page.tsx

// Tabela com:
// - Email
// - Nome
// - Organização
// - Role (user/admin)
// - Status (ativo/inativo)
// - Data de cadastro
// - Último acesso
// - Ações: Editar | Ver atividades | Desativar

// Botão: "+ Novo usuário"
// Filtros: Status, Organização, Data
```

### 4. `/admin/plans` — Gestão de Planos

```typescript
// apps/dashboard/src/app/admin/plans/page.tsx

// Tabela com:
// - Organização
// - Plano (Starter/Professional/Enterprise)
// - Status (ativo/trial/cancelado)
// - Data início
// - Data vencimento
// - Limite: clientes, contas, relatórios
// - Ações: Upgrade | Extend trial | Aplicar desconto

// Gráficos:
// - Distribuição de planos (pie chart)
// - MRR por plano (bar chart)
```

### 5. `/admin/payments` — Histórico de Pagamentos

```typescript
// apps/dashboard/src/app/admin/payments/page.tsx

// Tabela com:
// - Data
// - Organização
// - Valor
// - Método (Stripe/cartão)
// - Status (pago/pendente/falhou)
// - Invoice
// - Ações: Reprocessar | Emitir crédito | Ver recibo

// Filtros: Status, Data, Intervalo de valor
// KPI: Taxa de sucesso de pagamento
```

### 6. `/admin/analytics` — Métricas Globais

```typescript
// apps/dashboard/src/app/admin/analytics/page.tsx

// KPIs:
// - ARR (Annual Recurring Revenue)
// - MRR (Monthly Recurring Revenue)
// - MAU (Monthly Active Users)
// - DAU (Daily Active Users)
// - Churn rate
// - NPS
// - Feature adoption (% usando relatórios, WhatsApp, etc)

// Gráficos:
// - MRR growth (line chart)
// - User acquisition (bar chart)
// - Churn by plan
// - Revenue by plan
```

### 7. `/admin/logs` — Auditoria

```typescript
// apps/dashboard/src/app/admin/logs/page.tsx

// Tabela com histórico de eventos:
// - Data/hora
// - Tipo (login | sync_meta | report_sent | error)
// - Usuário/Organização
// - Descrição
// - Nível (INFO | WARN | ERROR)

// Filtros:
// - Tipo de evento
// - Por usuário
// - Por organização
// - Data range
// - Nível
```

---

## 🔌 APIs ADMIN (ESTRUTURA)

### Padrão de Rotas Admin

```
/api/admin/
├── users/
│   ├── route.ts          → GET (listar), POST (criar)
│   └── [id]/route.ts     → GET (detalhe), PATCH (editar), DELETE (desativar)
├── plans/
│   ├── route.ts          → GET (listar)
│   └── [id]/route.ts     → GET (detalhe), PATCH (upgrade/downgrade)
├── payments/
│   ├── route.ts          → GET (histórico)
│   └── [id]/route.ts     → POST (reprocessar)
├── analytics/
│   ├── route.ts          → GET (métricas globais)
│   ├── mrr/route.ts      → GET (MRR histórico)
│   ├── churn/route.ts    → GET (churn analysis)
│   └── features/route.ts → GET (feature adoption)
└── logs/
    └── route.ts          → GET (histórico com filtros)
```

### Exemplo: `GET /api/admin/users`

```typescript
// apps/dashboard/src/app/api/admin/users/route.ts

import { requireAdmin } from "@/lib/admin/permissions";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // 1. Verificar se é admin
    await requireAdmin();

    // 2. Query DIRETA sem RLS
    const supabase = await createClient();

    const { data: users, error } = await supabase
      .from("profiles")
      .select(`
        id,
        email: auth.email,
        name,
        org:organizations(name),
        role,
        created_at,
        updated_at
      `);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: users,
      total: users.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
```

---

## 💾 BANCO DE DADOS — PRONTO

**Tabelas necessárias já existem:**
- ✅ `organizations` — empresas
- ✅ `profiles` — usuários + role (admin/user)
- ✅ `plans` — tipos de planos
- ✅ `subscriptions` — assinatura por org (futuro)

**Colunas que faltam (para adicionar):**
```sql
-- Em profiles
ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMPTZ;

-- Criar tabela de admin_logs
CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action VARCHAR(50) NOT NULL,  -- 'create_user', 'upgrade_plan', etc
  target_type VARCHAR(50),      -- 'user', 'plan', 'payment'
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de analytics snapshot
CREATE TABLE public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  total_users INT,
  total_mau INT,
  total_dau INT,
  total_mrr DECIMAL,
  total_arr DECIMAL,
  churn_rate DECIMAL,
  nps DECIMAL,
  timestamp TIMESTAMPTZ DEFAULT now()
);
```

---

## 🚀 ROADMAP DE IMPLEMENTAÇÃO

### Sprint 4 (Esta semana)
- ✅ Client Portal (`/shared/dashboard/[token]`)
- ✅ APIs de token compartilhado
- ❌ Admin (preparado, não implementado)

### Sprint 6 (em 4 semanas)
- 🔴 Implementar `/admin/*` rotas
- 🔴 Implementar `/api/admin/*` APIs
- 🔴 Componentes admin (tabelas, gráficos)
- 🔴 Integração com Stripe para pagamentos

### Sprint 7
- 🔴 Dashboard de analytics avançado
- 🔴 Alertas automáticos de problemas
- 🔴 Reports de saúde da plataforma

---

## ✅ CHECKLIST DE PREPARAÇÃO

Estrutura **JÁ PRONTA** para implementação:

- ✅ Diretórios criados (`/admin`, `/api/admin`, `/shared`)
- ✅ Tipos TypeScript definidos
- ✅ RLS policies em (dashboard) vs sem RLS (admin)
- ✅ Middleware de autenticação admin
- ✅ Rotas mapeadas
- ✅ APIs mapeadas
- ✅ Banco de dados preparado

Tudo que falta é **implementação visual** em Sprint 6.

---

## 📝 Notas Importantes

1. **Admin login:** Hardcoded para `evandro@startinc.com.br` (ou validação via role)
2. **Isolamento:** Admin não usa RLS — acesso direto a TUDO
3. **Auditoria:** Toda ação admin é registrada em `admin_logs`
4. **Segurança:** MFA recomendado para admin (futuro)
5. **Separação:** Admin é uma *aplicação separada* visualmente

---

## Próximas Ações

1. ✅ **Agora (Sprint 4):** Implementar Cliente Portal (`/shared/*`)
2. ⏭️ **Sprint 6:** Implementar Admin Panel (`/admin/*`)
3. ⏭️ **Sprint 8:** Portal Cliente Final completo
