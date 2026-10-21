-- ============================================================
-- whatsapp_instances: instâncias do Evolution API por cliente.
-- As rotas /api/whatsapp/instances/** e o webhook /api/webhooks/whatsapp
-- já gravam nesta tabela, mas ela nunca foi criada.
-- RLS por org_id (mesmo padrão de clients); o webhook usa service role.
-- Só cria; re-executável.
-- ============================================================

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  phone_number      TEXT CHECK (phone_number IS NULL OR char_length(phone_number) <= 32),
  is_primary        BOOLEAN NOT NULL DEFAULT TRUE,
  instance_name     TEXT NOT NULL UNIQUE CHECK (char_length(instance_name) BETWEEN 1 AND 120),
  status            TEXT NOT NULL DEFAULT 'connecting'
                    CHECK (status IN ('connecting', 'connected', 'disconnected', 'error', 'deleted')),
  qr_code           TEXT,
  target_group_id   TEXT CHECK (target_group_id IS NULL OR char_length(target_group_id) <= 128),
  target_group_name TEXT CHECK (target_group_name IS NULL OR char_length(target_group_name) <= 200),
  last_connected_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_instances_org_idx ON public.whatsapp_instances (org_id);
CREATE INDEX IF NOT EXISTS whatsapp_instances_client_idx ON public.whatsapp_instances (client_id);

DROP TRIGGER IF EXISTS whatsapp_instances_touch ON public.whatsapp_instances;
CREATE TRIGGER whatsapp_instances_touch
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.reports_touch_updated_at();

DROP TRIGGER IF EXISTS whatsapp_instances_same_org ON public.whatsapp_instances;
CREATE TRIGGER whatsapp_instances_same_org
  BEFORE INSERT OR UPDATE OF org_id, client_id ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.reports_assert_same_org();

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_instances_select_org ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_select_org ON public.whatsapp_instances
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS whatsapp_instances_insert_org ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_insert_org ON public.whatsapp_instances
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS whatsapp_instances_update_org ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_update_org ON public.whatsapp_instances
  FOR UPDATE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS whatsapp_instances_delete_org ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_delete_org ON public.whatsapp_instances
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

REVOKE ALL ON public.whatsapp_instances FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
