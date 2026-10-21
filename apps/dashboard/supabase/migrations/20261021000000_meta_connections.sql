-- ============================================================
-- meta_connections: a conexão Meta (OAuth) da organização, separada
-- das contas de anúncio. Conectar deixa de importar todas as contas;
-- o usuário escolhe quais entram no painel.
-- Também libera ad_accounts.status = 'hidden' (conta fora do painel,
-- sem apagar campanhas/métricas que dependem dela).
-- Re-executável.
-- ============================================================

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.meta_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_encrypted  TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  fb_user_id       TEXT CHECK (fb_user_id IS NULL OR char_length(fb_user_id) <= 64),
  connected_by     UUID,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'expired', 'revoked')),
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS meta_connections_touch ON public.meta_connections;
CREATE TRIGGER meta_connections_touch
  BEFORE UPDATE ON public.meta_connections
  FOR EACH ROW EXECUTE FUNCTION public.reports_touch_updated_at();

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_connections_select_org ON public.meta_connections;
CREATE POLICY meta_connections_select_org ON public.meta_connections
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS meta_connections_insert_org ON public.meta_connections;
CREATE POLICY meta_connections_insert_org ON public.meta_connections
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS meta_connections_update_org ON public.meta_connections;
CREATE POLICY meta_connections_update_org ON public.meta_connections
  FOR UPDATE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS meta_connections_delete_org ON public.meta_connections;
CREATE POLICY meta_connections_delete_org ON public.meta_connections
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

REVOKE ALL ON public.meta_connections FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_connections TO authenticated;

-- ad_accounts.status: se existir CHECK de status, troca por um que aceite 'hidden'
-- e mantém os valores já usados (active, expired, disconnected, disabled).
-- Sem CHECK em produção, nada é criado aqui.
DO $$
DECLARE
  constraint_row RECORD;
  had_status_check BOOLEAN := FALSE;
BEGIN
  FOR constraint_row IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.ad_accounts'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      AND con.conname <> 'ad_accounts_status_check_v2'
  LOOP
    had_status_check := TRUE;
    EXECUTE format('ALTER TABLE public.ad_accounts DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;

  IF had_status_check AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ad_accounts'::regclass
      AND conname = 'ad_accounts_status_check_v2'
  ) THEN
    ALTER TABLE public.ad_accounts
      ADD CONSTRAINT ad_accounts_status_check_v2
      CHECK (status IN ('active', 'expired', 'disconnected', 'disabled', 'hidden')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ad_accounts'::regclass
      AND conname = 'ad_accounts_status_check_v2'
      AND NOT convalidated
  ) THEN
    ALTER TABLE public.ad_accounts VALIDATE CONSTRAINT ad_accounts_status_check_v2;
  END IF;
END $$;
