-- Migration: Add Clients Table (Complete)
-- Dependencies: public.organizations, public.ad_accounts
-- Sprint 1 - Client Management

-- ============================================================
-- 1. TABELA CLIENTS
-- ============================================================

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.clients IS 'Clientes gerenciados pela agência (organização). Cada cliente pode ter várias contas de anúncios.';
COMMENT ON COLUMN public.clients.archived_at IS 'Soft delete - clientes são arquivados, não excluídos fisicamente.';

-- ============================================================
-- 2. RLS - ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own_org"
    ON public.clients
    FOR SELECT
    USING (org_id = auth_org_id());

CREATE POLICY "clients_insert_own_org"
    ON public.clients
    FOR INSERT
    WITH CHECK (org_id = auth_org_id());

CREATE POLICY "clients_update_own_org"
    ON public.clients
    FOR UPDATE
    USING (org_id = auth_org_id())
    WITH CHECK (org_id = auth_org_id());

CREATE POLICY "clients_delete_own_org"
    ON public.clients
    FOR DELETE
    USING (org_id = auth_org_id());

-- ============================================================
-- 3. TRIGGER UPDATED_AT
-- ============================================================

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================
-- 4. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_archived_at ON public.clients(archived_at)
    WHERE archived_at IS NULL;

-- ============================================================
-- 5. ADICIONAR CLIENT_ID EM AD_ACCOUNTS
-- ============================================================

ALTER TABLE public.ad_accounts
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ad_accounts_client_id ON public.ad_accounts(client_id);

COMMENT ON COLUMN public.ad_accounts.client_id IS 'Cliente associado a esta conta de anúncio (opcional).';

-- ============================================================
-- 6. FUNÇÃO AUXILIAR: CONTAR AD_ACCOUNTS POR CLIENTE
-- ============================================================

CREATE OR REPLACE FUNCTION get_client_accounts_count(client_uuid UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)
    FROM public.ad_accounts
    WHERE client_id = client_uuid
    AND status = 'active';
$$ LANGUAGE sql STABLE;
