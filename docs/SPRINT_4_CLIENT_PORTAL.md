# Sprint 4 — Client Portal & Shared Access

**Duração estimada:** 1-2 semanas
**Prioridade:** 🔴 CRÍTICO
**Dependências:** Sprint 0-3 concluídos
**Responsável sugerido:** @dev

---

## O que é este sprint?

Implementar a **Camada 3 (Cliente Final)** — um portal público onde clientes do gestor podem visualizar dashboards e relatórios sem fazer login.

**Funcionalidade chave:**
- ✅ Gerar link compartilhável com token aleatório
- ✅ Visualizar dashboard só-leitura (marca branca)
- ✅ Baixar relatórios em PDF
- ✅ Proteger com senha opcional
- ✅ Rastrear acessos e limitar validade

---

## Contexto atual

| Item | Status |
|------|--------|
| Tabelas `shared_links`, `reports_sent` | ❌ Não existem |
| API de geração de tokens | ❌ Não existe |
| Página `/shared/dashboard/[token]` | ❌ Não existe |
| Senha de acesso ao link | ❌ Não existe |
| Marca branca do gestor | ❌ Não existe |
| Histórico de relatórios | ❌ Não existe |

---

## Etapas de execução

### S4.1 — Migrations: Criar tabelas necessárias

**Arquivo:** `migrations/[timestamp]_create_shared_links.sql`

```sql
-- Tabela de links compartilhados
CREATE TABLE IF NOT EXISTS public.shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT,  -- bcrypt hash (opcional)
  access_type VARCHAR(20) DEFAULT 'dashboard',  -- 'dashboard' | 'report'
  expires_at TIMESTAMPTZ NOT NULL,
  max_accesses INT,  -- NULL = ilimitado
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  metadata JSONB  -- Dados customizados (período, filtros, etc)
);

-- RLS (sem RLS — acesso via token público)
ALTER TABLE public.shared_links DISABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX idx_shared_links_token ON public.shared_links(token);
CREATE INDEX idx_shared_links_client_id ON public.shared_links(client_id);
CREATE INDEX idx_shared_links_org_id ON public.shared_links(org_id);
CREATE INDEX idx_shared_links_expires_at ON public.shared_links(expires_at);

-- Tabela de histórico de relatórios enviados
CREATE TABLE IF NOT EXISTS public.reports_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'sent',  -- 'draft' | 'sent' | 'failed'
  delivery_method VARCHAR(20) NOT NULL,  -- 'email' | 'whatsapp' | 'shared_link'
  delivery_to TEXT,  -- email ou número WhatsApp
  pdf_url TEXT,
  shared_link_token VARCHAR(64) REFERENCES public.shared_links(token) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.reports_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_sent_select_own_org" ON public.reports_sent
  FOR SELECT USING (org_id = public.get_user_org_id());

CREATE POLICY "reports_sent_insert_own_org" ON public.reports_sent
  FOR INSERT WITH CHECK (org_id = public.get_user_org_id());

-- Índices
CREATE INDEX idx_reports_sent_client_id ON public.reports_sent(client_id);
CREATE INDEX idx_reports_sent_org_id ON public.reports_sent(org_id);
CREATE INDEX idx_reports_sent_status ON public.reports_sent(status);
CREATE INDEX idx_reports_sent_sent_at ON public.reports_sent(sent_at DESC);

-- Tabela de templates de relatório (para futuro)
CREATE TABLE IF NOT EXISTS public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  layout JSONB NOT NULL,  -- Estrutura do template
  includes_kpis BOOLEAN DEFAULT true,
  includes_campaigns BOOLEAN DEFAULT true,
  includes_comparison BOOLEAN DEFAULT false,
  frequency VARCHAR(20),  -- 'daily' | 'weekly' | 'monthly'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_templates_select_own_org" ON public.report_templates
  FOR SELECT USING (org_id = public.get_user_org_id());

-- Índices
CREATE INDEX idx_report_templates_org_id ON public.report_templates(org_id);
```

### S4.2 — Atualizar `lib/supabase/types.ts`

Adicionar tipos TypeScript para as novas tabelas:

```typescript
export type SharedLink = {
  id: string;
  org_id: string;
  client_id: string;
  token: string;
  password_hash: string | null;
  access_type: 'dashboard' | 'report';
  expires_at: string;
  max_accesses: number | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  created_by: string;
  revoked_at: string | null;
  metadata: Record<string, any> | null;
};

export type ReportSent = {
  id: string;
  org_id: string;
  client_id: string;
  report_template_id: string | null;
  status: 'draft' | 'sent' | 'failed';
  delivery_method: 'email' | 'whatsapp' | 'shared_link';
  delivery_to: string | null;
  pdf_url: string | null;
  shared_link_token: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type ReportTemplate = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  layout: Record<string, any>;
  includes_kpis: boolean;
  includes_campaigns: boolean;
  includes_comparison: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
```

### S4.3 — API: Gerar token de compartilhamento

**Arquivo:** `apps/dashboard/src/app/api/shared/generate-token/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcrypt";

const GenerateTokenSchema = z.object({
  client_id: z.string().uuid(),
  access_type: z.enum(["dashboard", "report"]),
  expires_in_days: z.number().min(1).max(365).default(30),
  password: z.string().optional().or(z.literal("")),
  max_accesses: z.number().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const validated = GenerateTokenSchema.parse(body);

    // Validar que cliente pertence à org
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", validated.client_id)
      .eq("org_id", profile.org_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Gerar token aleatório
    const token = crypto.randomBytes(32).toString("hex");

    // Hash da senha (se fornecida)
    let passwordHash = null;
    if (validated.password) {
      passwordHash = await bcrypt.hash(validated.password, 10);
    }

    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (validated.expires_in_days || 30));

    // Inserir link compartilhado
    const { data: sharedLink, error: insertError } = await supabase
      .from("shared_links")
      .insert({
        org_id: profile.org_id,
        client_id: validated.client_id,
        token,
        password_hash: passwordHash,
        access_type: validated.access_type,
        expires_at: expiresAt.toISOString(),
        max_accesses: validated.max_accesses,
        created_by: user.id,
        metadata: validated.metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar link compartilhado:", insertError);
      return NextResponse.json({ error: "Erro ao gerar link" }, { status: 500 });
    }

    // Retornar URL de acesso
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shared/${validated.access_type}/${token}`;

    return NextResponse.json({
      data: {
        token: sharedLink.token,
        url: shareUrl,
        qr_code: null,  // TODO: gerar QR code
        expires_at: sharedLink.expires_at,
        protected: !!passwordHash,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

### S4.4 — API: Validar token & retornar dados

**Arquivo:** `apps/dashboard/src/app/api/shared/validate/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

interface ValidateTokenRequest {
  token: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const { token, password } = (await request.json()) as ValidateTokenRequest;

    if (!token) {
      return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 });
    }

    const supabase = await createClient();

    // Buscar link compartilhado
    const { data: sharedLink, error: linkError } = await supabase
      .from("shared_links")
      .select("*")
      .eq("token", token)
      .is("revoked_at", null)
      .single();

    if (linkError || !sharedLink) {
      return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
    }

    // Validar expiração
    if (new Date(sharedLink.expires_at) < new Date()) {
      return NextResponse.json({ error: "Link expirado" }, { status: 403 });
    }

    // Validar limite de acessos
    if (sharedLink.max_accesses && sharedLink.access_count >= sharedLink.max_accesses) {
      return NextResponse.json({ error: "Limite de acessos atingido" }, { status: 403 });
    }

    // Validar senha (se houver)
    if (sharedLink.password_hash) {
      if (!password) {
        return NextResponse.json({ error: "Senha necessária" }, { status: 403 });
      }
      const passwordValid = await bcrypt.compare(password, sharedLink.password_hash);
      if (!passwordValid) {
        return NextResponse.json({ error: "Senha incorreta" }, { status: 403 });
      }
    }

    // Incrementar contador de acessos
    const { error: updateError } = await supabase
      .from("shared_links")
      .update({
        access_count: sharedLink.access_count + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("token", token);

    if (updateError) {
      console.error("Erro ao atualizar contador:", updateError);
    }

    // Retornar dados do cliente (sem exposição de org_id)
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, email, logo_url")
      .eq("id", sharedLink.client_id)
      .single();

    return NextResponse.json({
      data: {
        token,
        client_id: sharedLink.client_id,
        client_name: client?.name,
        org_id: sharedLink.org_id,
        access_type: sharedLink.access_type,
        valid: true,
      },
    });
  } catch (error) {
    console.error("Erro ao validar token:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

### S4.5 — Página: `/shared/dashboard/[token]`

**Arquivo:** `apps/dashboard/src/app/shared/dashboard/[token]/page.tsx`

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SharedDashboardClient from "./SharedDashboardClient";

interface SharedDashboardPageProps {
  params: { token: string };
  searchParams: { password?: string };
}

export default async function SharedDashboardPage({
  params,
  searchParams,
}: SharedDashboardPageProps) {
  const supabase = await createClient();
  const token = params.token;

  // Validar token no servidor
  const { data: sharedLink, error: linkError } = await supabase
    .from("shared_links")
    .select("*")
    .eq("token", token)
    .is("revoked_at", null)
    .single();

  if (linkError || !sharedLink) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-200 mb-2">Link Inválido</h1>
          <p className="text-slate-400">Este link foi removido ou expirou.</p>
        </div>
      </div>
    );
  }

  // Validar expiração
  if (new Date(sharedLink.expires_at) < new Date()) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-200 mb-2">Link Expirado</h1>
          <p className="text-slate-400">Este link foi removido ou expirou.</p>
        </div>
      </div>
    );
  }

  // Se tem senha, validar
  if (sharedLink.password_hash && !searchParams.password) {
    redirect(`/shared/auth/${token}`);
  }

  // Buscar dados do cliente (para marca branca)
  const { data: org } = await supabase
    .from("organizations")
    .select("name, logo_url, theme_color")
    .eq("id", sharedLink.org_id)
    .single();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, email, logo_url")
    .eq("id", sharedLink.client_id)
    .single();

  // Buscar métricas do cliente
  const { data: metrics } = await supabase
    .from("daily_metrics")
    .select(
      `
      *,
      campaigns (id, name, status)
    `
    )
    .eq("org_id", sharedLink.org_id)
    .eq("client_id", sharedLink.client_id)
    .order("date", { ascending: false })
    .limit(30);

  return (
    <SharedDashboardClient
      client={client}
      org={org}
      metrics={metrics || []}
      token={token}
    />
  );
}
```

**Arquivo:** `apps/dashboard/src/app/shared/dashboard/[token]/SharedDashboardClient.tsx`

```typescript
"use client";

import { motion } from "framer-motion";
import { Download, Share2, AlertCircle, Clock } from "lucide-react";
import { useState } from "react";

interface SharedDashboardClientProps {
  client: any;
  org: any;
  metrics: any[];
  token: string;
}

export default function SharedDashboardClient({
  client,
  org,
  metrics,
  token,
}: SharedDashboardClientProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const totalSpend = metrics.reduce((sum, m) => sum + m.spend, 0);
  const totalConversions = metrics.reduce((sum, m) => sum + m.conversions, 0);
  const avgROAS = totalSpend > 0 ? metrics.reduce((sum, m) => sum + m.roas, 0) / metrics.length : 0;

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      // TODO: Gerar PDF do relatório
      console.log("Download PDF");
    } catch (error) {
      console.error("Erro ao baixar PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header com marca branca */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {org?.logo_url && (
                <img src={org.logo_url} alt={org.name} className="h-8 w-8 rounded" />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                  {org?.name}
                </p>
                <h1 className="text-xl font-bold text-white">{client?.name}</h1>
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 disabled:opacity-50"
            >
              <Download size={16} />
              {isDownloading ? "Baixando..." : "Baixar PDF"}
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6"
          >
            <p className="text-sm text-slate-400 mb-1">Investimento Total</p>
            <p className="text-3xl font-bold text-white">
              R$ {(totalSpend / 1000).toFixed(1)}K
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6"
          >
            <p className="text-sm text-slate-400 mb-1">Conversões</p>
            <p className="text-3xl font-bold text-white">{totalConversions}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6"
          >
            <p className="text-sm text-slate-400 mb-1">ROAS Médio</p>
            <p className="text-3xl font-bold text-white">{avgROAS.toFixed(2)}x</p>
          </motion.div>
        </div>

        {/* Gráfico de performance (placeholder) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Performance</h2>
          <div className="h-64 flex items-center justify-center text-slate-500">
            Gráfico de performance (futuro)
          </div>
        </div>

        {/* Info de segurança */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
          <Clock className="text-slate-400 flex-shrink-0 mt-1" size={18} />
          <div className="text-sm text-slate-400">
            <p className="font-semibold">Link de acesso compartilhado</p>
            <p>Este relatório é compartilhado privadamente e protegido.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### S4.6 — Página: `/shared/auth/[token]` (validação de senha)

**Arquivo:** `apps/dashboard/src/app/shared/auth/[token]/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

interface SharedAuthPageProps {
  params: { token: string };
}

export default function SharedAuthPage({ params }: SharedAuthPageProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/shared/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.token,
          password,
        }),
      });

      if (response.ok) {
        // Redirecionar para dashboard com senha
        router.push(`/shared/dashboard/${params.token}?password=${encodeURIComponent(password)}`);
      } else {
        const data = await response.json();
        setError(data.error || "Senha incorreta");
      }
    } catch (err) {
      setError("Erro ao validar senha");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="w-full max-w-md">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Lock className="text-cyan-400" size={24} />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">Acesso Protegido</h1>
          <p className="text-slate-400 text-center mb-6">
            Este relatório requer uma senha para acessar.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none mb-4"
              disabled={isLoading}
            />

            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full px-4 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Validando..." : "Acessar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### S4.7 — UI: Botão "Compartilhar" na página do cliente

**Arquivo:** `apps/dashboard/src/app/(dashboard)/clients/[id]/page.tsx` (modificar)

Adicionar aba de "Relatórios" com botão "+ Compartilhar" que abre modal de geração de token.

---

## Critérios de aceite

- [ ] Tabelas `shared_links`, `reports_sent`, `report_templates` existem
- [ ] API `POST /api/shared/generate-token` funciona
- [ ] API `POST /api/shared/validate` funciona
- [ ] Página `/shared/dashboard/[token]` é acessível sem login
- [ ] Dashboard compartilhado mostra marca branca do gestor
- [ ] Senha opcional protege o link
- [ ] Contador de acessos é incrementado
- [ ] Links expiram após data configurada
- [ ] Cliente final consegue baixar PDF
- [ ] Gestor consegue compartilhar link via WhatsApp/Email

---

## Arquivos que serão criados/modificados

| Arquivo | Ação |
|---------|------|
| `migrations/[timestamp]_create_shared_links.sql` | CRIAR |
| `lib/supabase/types.ts` | MODIFICAR |
| `apps/dashboard/src/app/api/shared/generate-token/route.ts` | CRIAR |
| `apps/dashboard/src/app/api/shared/validate/route.ts` | CRIAR |
| `apps/dashboard/src/app/shared/dashboard/[token]/page.tsx` | CRIAR |
| `apps/dashboard/src/app/shared/dashboard/[token]/SharedDashboardClient.tsx` | CRIAR |
| `apps/dashboard/src/app/shared/auth/[token]/page.tsx` | CRIAR |
| `apps/dashboard/src/app/(dashboard)/clients/[id]/page.tsx` | MODIFICAR |

---

## Próximos passos (após S4)

### Sprint 5: Relatórios Automáticos
- Editor de template drag-drop
- Agendamento de envio (cron)
- Geração de PDF

### Sprint 6: Painel Admin
- Estrutura de rotas separadas `/admin/*`
- Login admin diferenciado
- Dashboard de gestão

### Sprint 8: Portal Cliente Avançado
- Marca branca completa
- Compartilhamento de múltiplos períodos
- Notificações em tempo real
