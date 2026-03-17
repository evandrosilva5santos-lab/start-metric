-- Sprint 4 - WhatsApp Connection
-- Cria/atualiza estrutura de instancias WhatsApp por cliente

CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  instance_name TEXT NOT NULL,
  api_url TEXT,
  api_key TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  qr_code TEXT,
  webhook_url TEXT,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMPTZ;

ALTER TABLE public.whatsapp_instances
  ALTER COLUMN status SET DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_instances_status_check'
  ) THEN
    ALTER TABLE public.whatsapp_instances
      ADD CONSTRAINT whatsapp_instances_status_check
      CHECK (status IN ('pending', 'connecting', 'connected', 'disconnected', 'error', 'deleted'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_org_instance
  ON public.whatsapp_instances(org_id, instance_name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_org_id
  ON public.whatsapp_instances(org_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_client_id
  ON public.whatsapp_instances(client_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status
  ON public.whatsapp_instances(status);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_instances_select_own_org ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_select_own_org
  ON public.whatsapp_instances
  FOR SELECT
  USING (org_id = auth_org_id());

DROP POLICY IF EXISTS whatsapp_instances_insert_own_org ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_insert_own_org
  ON public.whatsapp_instances
  FOR INSERT
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS whatsapp_instances_update_own_org ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_update_own_org
  ON public.whatsapp_instances
  FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS whatsapp_instances_delete_own_org ON public.whatsapp_instances;
CREATE POLICY whatsapp_instances_delete_own_org
  ON public.whatsapp_instances
  FOR DELETE
  USING (org_id = auth_org_id());

DROP TRIGGER IF EXISTS trg_whatsapp_instances_updated_at ON public.whatsapp_instances;
CREATE TRIGGER trg_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
