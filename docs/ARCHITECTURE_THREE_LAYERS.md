# Start Metric — Arquitetura de 3 Camadas de Acesso

**Data:** 2026-03-17
**Status:** Documentação de Referência

---

## 🎭 AS 3 CAMADAS DE ACESSO

```
┌──────────────────────────────────────────────────────────────────┐
│ CAMADA 1: ADMIN (Dono do App)                                    │
│ ────────────────────────────────────────────────────────────────│
│ Usuário: evandro@startinc.com.br                                 │
│ Role: admin                                                       │
│ Acesso: /admin (painel administrativo)                           │
│                                                                   │
│ Responsabilidades:                                               │
│ • Gerenciar usuários (criar, ativar, desativar)                 │
│ • Gerenciar planos e subscriptions                              │
│ • Ver pagamentos e faturamento (Stripe)                         │
│ • Analytics global da plataforma                                │
│ • Auditoria de logs e atividades                                │
│ • Controle de acesso e permissões                               │
│                                                                   │
│ Dados visíveis: TUDO (multi-tenant global)                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ CAMADA 2: USUÁRIO PAGANTE (Gestor de Tráfego)                   │
│ ────────────────────────────────────────────────────────────────│
│ Usuários: Gestores/Agências que pagam pela plataforma           │
│ Role: user (com org_id próprio)                                 │
│ Acesso: /dashboard, /clients, /settings, /reports               │
│                                                                   │
│ Responsabilidades:                                               │
│ • Conectar contas Meta/Google Ads                               │
│ • Gerenciar clientes finais (criar, editar, arquivar)           │
│ • Acompanhar performance de cada cliente                        │
│ • Criar e agendar relatórios automáticos                        │
│ • Configurar integrações WhatsApp                               │
│ • Enviar relatórios/dashboards para clientes                    │
│                                                                   │
│ Dados visíveis: APENAS sua org + clientes vinculados            │
│ Isolamento: WHERE org_id = auth.uid() → org_id                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ CAMADA 3: CLIENTE FINAL (Portal Compartilhado)                  │
│ ────────────────────────────────────────────────────────────────│
│ Usuários: Clientes finais do gestor (não fazem login)            │
│ Role: NENHUM (acesso via link compartilhado + senha)            │
│ Acesso: /shared/dashboard/[token] ou /shared/report/[token]     │
│                                                                   │
│ Responsabilidades:                                               │
│ • Visualizar dashboard do seu negócio (só-leitura)              │
│ • Baixar relatórios em PDF                                      │
│ • Ver histórico de relatórios anteriores                        │
│ • (Opcional) Receber notificações via WhatsApp                  │
│                                                                   │
│ Dados visíveis: APENAS do cliente associado (filtrado)          │
│ Isolamento: Validação de token + client_id no link              │
│ Autenticação: Senha única + link token (sem login de conta)     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📊 ESTRUTURA DE DADOS (RLS + Isolamento)

```sql
┌─ CAMADA 1: ADMIN (evandro@startinc.com) ─────────────────┐
│                                                            │
│ SELECT * FROM organizations;  -- Vê TODAS                │
│ SELECT * FROM profiles WHERE role = 'admin'; -- Todos     │
│ SELECT * FROM ad_accounts;    -- Vê TODAS as contas      │
│ SELECT * FROM clients;         -- Vê TODOS os clientes   │
│ SELECT * FROM plans;           -- Todas subscriptions    │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌─ CAMADA 2: USER (gestor@agencia.com) ──────────────────────┐
│                                                             │
│ RLS Policy: org_id = get_user_org_id()                    │
│                                                             │
│ SELECT * FROM clients                                      │
│   WHERE org_id = 'org-123'                                │
│   AND archived_at IS NULL;  -- Seus clientes              │
│                                                             │
│ SELECT * FROM ad_accounts                                 │
│   WHERE org_id = 'org-123';  -- Suas contas              │
│                                                             │
│ SELECT * FROM daily_metrics                               │
│   WHERE org_id = 'org-123'                               │
│   AND campaign_id IN (                                    │
│     SELECT id FROM campaigns                              │
│     WHERE ad_account_id IN (                              │
│       SELECT id FROM ad_accounts                          │
│       WHERE client_id = $client_id                        │
│     )                                                      │
│   );  -- Suas métricas por cliente                        │
│                                                             │
└────────────────────────────────────────────────────────────┘

┌─ CAMADA 3: CLIENT FINAL (via token público) ───────────────┐
│                                                             │
│ SEM RLS (acesso via API pública com token)                │
│                                                             │
│ GET /api/shared/dashboard/[token]                         │
│   → Valida token + client_id                              │
│   → Retorna apenas métricas desse cliente                │
│   → Nunca exposição org_id ou dados outros clientes      │
│                                                             │
│ GET /api/shared/reports/[token]                          │
│   → Retorna apenas relatórios desse cliente              │
│   → PDF pré-gerado + senha de acesso                     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 🔐 AUTENTICAÇÃO & AUTORIZAÇÃO

### Camada 1: Admin (evandro@startinc.com)

```typescript
// Rota: /admin
// Arquivo: apps/dashboard/src/app/admin/layout.tsx

async function AdminLayout() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // ✅ Apenas role='admin' acessa
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  return <AdminPanelClient />;
}
```

**Acesso:** `evandro@startinc.com.br` (hardcoded ou via role)

---

### Camada 2: Usuário Pagante

```typescript
// Rota: /dashboard, /clients, /settings
// RLS garante isolamento automático

async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // RLS automático: WHERE org_id = get_user_org_id()
  const { data: clients } = await supabase
    .from('clients')
    .select('*');  // Retorna APENAS clientes da sua org

  return <ClientsPageClient clients={clients} />;
}
```

**Acesso:** Qualquer usuário com login + perfil na org

---

### Camada 3: Cliente Final (Portal Público)

```typescript
// Rota: /shared/dashboard/[token]
// Sem autenticação Supabase — validação de token manual

async function SharedDashboardPage({ params }: { params: { token: string } }) {
  // 1. Validar token (buscar na tabela shared_links)
  const { data: sharedLink, error } = await supabase
    .from('shared_links')
    .select('client_id, org_id, expires_at, password_hash')
    .eq('token', params.token)
    .single();

  if (error || !sharedLink || new Date(sharedLink.expires_at) < new Date()) {
    return <div>Link expirado ou inválido</div>;
  }

  // 2. Se há senha, validar
  if (sharedLink.password_hash) {
    // mostrar form de entrada de senha
  }

  // 3. Buscar dados do cliente (SEM RLS, query direta com validação)
  const { data: clientData } = await supabase
    .from('daily_metrics')
    .select(`
      *,
      campaigns(name, status)
    `)
    .eq('client_id', sharedLink.client_id)
    .eq('org_id', sharedLink.org_id);  // Dupla validação

  return <SharedDashboardView data={clientData} />;
}
```

**Acesso:** Link compartilhado com token único + senha opcional

---

## 📋 TABELAS NOVAS NECESSÁRIAS

### Tabela: `shared_links`

```sql
CREATE TABLE public.shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  token VARCHAR(64) UNIQUE NOT NULL,  -- Token aleatório
  password_hash TEXT,  -- Hash bcrypt (opcional)
  expires_at TIMESTAMPTZ NOT NULL,
  access_type VARCHAR(20) DEFAULT 'dashboard',  -- 'dashboard' | 'report'
  max_accesses INT,  -- Limite de acessos (null = ilimitado)
  access_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  revoked_at TIMESTAMPTZ  -- Para revogar link
);

-- Índices
CREATE INDEX idx_shared_links_token ON shared_links(token);
CREATE INDEX idx_shared_links_client_id ON shared_links(client_id);
CREATE INDEX idx_shared_links_org_id ON shared_links(org_id);
```

### Tabela: `reports_sent`

```sql
CREATE TABLE public.reports_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  report_template_id UUID REFERENCES report_templates(id),
  status VARCHAR(20) DEFAULT 'sent',  -- 'draft' | 'sent' | 'failed'
  delivery_method VARCHAR(20),  -- 'email' | 'whatsapp' | 'shared_link'
  delivery_to TEXT,  -- email ou número WhatsApp
  pdf_url TEXT,  -- URL do PDF armazenado
  shared_link_token VARCHAR(64),  -- Se foi via link
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reports_sent_client_id ON reports_sent(client_id);
CREATE INDEX idx_reports_sent_org_id ON reports_sent(org_id);
```

### Tabela: `report_templates`

```sql
CREATE TABLE public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  layout JSONB NOT NULL,  -- Estrutura do template (drag-drop)
  includes_kpis BOOLEAN DEFAULT true,
  includes_campaigns BOOLEAN DEFAULT true,
  includes_comparison BOOLEAN DEFAULT false,
  frequency VARCHAR(20),  -- 'daily' | 'weekly' | 'monthly'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_report_templates_org_id ON report_templates(org_id);
```

---

## 🎯 FLUXOS POR CAMADA

### Fluxo 1: Admin gerencia usuário pagante

```
Admin (/admin/users)
  ↓
  "Criar novo usuário"
  ↓
  • Email: gestor@agencia.com
  • Senha: gerada automática + link de reset
  • Org: Agência XYZ (ou criar nova)
  • Plano: Professional (R$ 799/mês)
  ↓
  ✅ Usuário criado → pode fazer login em /dashboard
```

### Fluxo 2: Gestor compartilha com cliente final

```
Gestor (/clients/[id])
  ↓
  Aba "Relatórios" → "+ Enviar relatório agora"
  ↓
  1. Selecionar template
  2. Selecionar período
  3. Escolher delivery:
     • Email (envia PDF)
     • WhatsApp (envia PDF + mensagem)
     • Link compartilhado (gera link público)
  ↓
  Se "Link compartilhado":
    ↓
    • Gera token aleatório
    • Cria entrada em shared_links
    • Link: https://startmetric.com/shared/dashboard/[token]
    • (Opcional) Adiciona senha
    • QR code para cliente final
    ↓
    Cliente final:
      ↓
      Escaneia QR ou clica link
      ↓
      Vê dashboard só-leitura (marca branca do gestor)
      ↓
      Pode baixar PDF do período
```

### Fluxo 3: Admin analisa saúde da plataforma

```
Admin (/admin)
  ↓
  Abas:
  • /admin/users → "5 usuários pagantes, 1 inativo"
  • /admin/plans → "MRR: R$ 12K, Churn: 1 (usuário expirou trial)"
  • /admin/payments → "5 pagamentos pendentes, 1 falhou"
  • /admin/analytics → "120 clientes gerenciados no total"
  • /admin/logs → "Erro: Sync Meta falhou para usuário X"
```

---

## 🗂️ ESTRUTURA DE ROTAS

### Admin Routes

```
/admin
├── /admin/users
│   ├── Listar usuários
│   ├── Criar/editar usuário
│   └── Ver atividades do usuário
├── /admin/plans
│   ├── Gerenciar planos
│   ├── Aplicar cupom/desconto
│   └── Upgrade/downgrade manual
├── /admin/payments
│   ├── Histórico de pagamentos
│   ├── Reprocessar falhas
│   └── Emitir crédito
├── /admin/analytics
│   ├── Dashboard de métricas
│   ├── MRR/ARR
│   └── Churn analysis
└── /admin/logs
    ├── Auditoria de atividades
    ├── Filtros por tipo/usuário
    └── Diagnóstico de erros
```

### User Routes (Gestor)

```
/dashboard
├── /dashboard (visão geral — sem cliente selecionado)
├── /clients
│   ├── Listar clientes
│   ├── /clients/[id] (detalhe)
│   │   ├── Visão geral
│   │   ├── Contas
│   │   ├── Relatórios
│   │   └── Timeline
│   └── Modal: Novo cliente / Editar
├── /settings
│   ├── /settings/profile (perfil do gestor)
│   ├── /settings/meta (conectar/desconectar Meta)
│   ├── /settings/whatsapp (gerenciar instâncias)
│   └── /settings/integrations
└── /reports (gestão de templates — Sprint 5)
    ├── Listar templates
    ├── Editor (drag-drop)
    └── Agendamento
```

### Shared Routes (Cliente Final)

```
/shared
├── /shared/dashboard/[token]
│   ├── Dashboard só-leitura (marca branca)
│   ├── Filtros de período
│   └── Download PDF
├── /shared/report/[token]
│   ├── Visualizar relatório
│   └── Download PDF
└── /shared/auth/[token]
    └── Validar senha (se necessário)
```

---

## 🔒 MATRIZ DE PERMISSÕES

| Ação | Admin | Usuário | Cliente Final |
|------|-------|---------|---------------|
| Ver todos os usuários | ✅ | ❌ | ❌ |
| Gerenciar planos | ✅ | ❌ | ❌ |
| Ver pagamentos | ✅ | ❌ | ❌ |
| Criar cliente | ❌ | ✅ | ❌ |
| Editar próprio cliente | ❌ | ✅ | ❌ |
| Ver dashboard do cliente | ❌ | ✅ | ✅ (via link) |
| Enviar relatório | ❌ | ✅ | ❌ |
| Compartilhar link | ❌ | ✅ | ❌ |
| Deletar cliente | ❌ | ✅ (soft) | ❌ |
| Ver logs globais | ✅ | ❌ | ❌ |
| Editar profil próprio | ✅ | ✅ | ❌ |
| Conectar Meta | ❌ | ✅ | ❌ |
| Configurar WhatsApp | ❌ | ✅ | ❌ |
| Baixar PDF | ❌ | ✅ | ✅ (via link) |

---

## 📱 EXEMPLO: Cliente Final Recebe Relatório

### Cenário
Gestor cria cliente "Ecommerce XYZ" e envia relatório semanal via WhatsApp.

```
Terça-feira, 10h:
  ↓
  Cron job: `/api/cron/send-reports`
  ↓
  Busca todos clients com frequency='weekly'
  ↓
  Para "Ecommerce XYZ":
    ↓
    1. Gera PDF com KPIs da semana
    2. Cria entrada em shared_links com token + expira em 30 dias
    3. Envia WhatsApp:
       "Olá! Seu relatório da semana está pronto.
        Clique aqui: https://startmetric.com/shared/dashboard/abc123xyz"
    4. Registra em reports_sent
  ↓
  Cliente final:
    ↓
    Clica link → /shared/dashboard/abc123xyz
    ↓
    Vê gráficos + KPIs (marca branca da agência)
    ↓
    Clica "Baixar PDF" → relatório em PDF
```

---

## 🎨 MARCA BRANCA (Cliente Final)

Quando acessa `/shared/dashboard/[token]`:

```jsx
// Buscar tema/marca da org do gestor
const { data: org } = await supabase
  .from('organizations')
  .select('name, logo_url, primary_color, secondary_color')
  .eq('id', sharedLink.org_id)
  .single();

return (
  <SharedDashboardView
    title={`${org.name} — Performance Report`}
    logo={org.logo_url}
    primaryColor={org.primary_color}
    // Tudo customizado com cores/logo do gestor
  />
);
```

---

## 🚀 IMPLEMENTAÇÃO (Prioridade)

### Sprint 4 (Esta semana)
- ✅ Criar tabelas `shared_links` + `reports_sent`
- ✅ API de geração de tokens de compartilhamento
- 🔄 Página `/shared/dashboard/[token]` (basic)

### Sprint 5
- 🔴 Editor de templates (drag-drop)
- 🔴 Agendamento de relatórios
- 🔴 Geração de PDF

### Sprint 6
- 🔴 Painel admin completo
- 🔴 Marca branca avançada
- 🔴 Analytics global

### Sprint 7+
- 🔴 Portal cliente completo (Sprint 8)
- 🔴 Notificações em tempo real
- 🔴 Assinatura digital

---

## ✅ Resumo Final

| Camada | Usuário | Acesso | Dados | Autenticação |
|--------|---------|--------|-------|--------------|
| **1 - Admin** | evandro@startinc.com | /admin | TUDO (global) | Supabase auth + role='admin' |
| **2 - User** | gestor@agencia.com | /dashboard, /clients | Sua org + clientes | Supabase auth + RLS |
| **3 - Client** | sem login | /shared/[token] | Cliente do gestor | Token público + senha opt. |

**Isolamento garantido por:**
- Camada 1: `role='admin'` check
- Camada 2: RLS policies (`org_id`)
- Camada 3: Token validation + `client_id` check
