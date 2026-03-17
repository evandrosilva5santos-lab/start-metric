-- Migration: Add Guests/Clients Table
-- Dependencies: public.organizations

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Only members of the organization can see its clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Note: public.current_org_id() is defined in 20260307000001_multi_tenant_auth.sql

CREATE POLICY "Users can view clients of their organization"
    ON public.clients
    FOR SELECT
    USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert clients into their organization"
    ON public.clients
    FOR INSERT
    WITH CHECK (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update clients of their organization"
    ON public.clients
    FOR UPDATE
    USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete clients of their organization"
    ON public.clients
    FOR DELETE
    USING (org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Link sm_meta_accounts to client
ALTER TABLE sm_meta_accounts ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

COMMENT ON TABLE public.clients IS 'Clientes gerenciados pela agência (organização). Cada cliente pode ter várias contas de anúncios.';
