-- Sprint 4: Client Portal & Shared Access
-- Criar tabelas para links compartilhados, relatórios enviados e templates

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

-- Índices para performance
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

-- RLS para relatórios enviados
ALTER TABLE public.reports_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_sent_select_own_org" ON public.reports_sent
  FOR SELECT USING (org_id = public.get_user_org_id());

CREATE POLICY "reports_sent_insert_own_org" ON public.reports_sent
  FOR INSERT WITH CHECK (org_id = public.get_user_org_id());

-- Índices para performance
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

-- RLS para templates
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_templates_select_own_org" ON public.report_templates
  FOR SELECT USING (org_id = public.get_user_org_id());

CREATE POLICY "report_templates_insert_own_org" ON public.report_templates
  FOR INSERT WITH CHECK (org_id = public.get_user_org_id());

CREATE POLICY "report_templates_update_own_org" ON public.report_templates
  FOR UPDATE USING (org_id = public.get_user_org_id());

CREATE POLICY "report_templates_delete_own_org" ON public.report_templates
  FOR DELETE USING (org_id = public.get_user_org_id());

-- Índices para performance
CREATE INDEX idx_report_templates_org_id ON public.report_templates(org_id);
CREATE INDEX idx_report_templates_is_active ON public.report_templates(is_active);
