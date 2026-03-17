-- ============================================================
-- MIGRATION: WhatsApp Instances (Sprint 4)
-- Adiciona suporte para instâncias conectadas por cliente
-- ============================================================

-- 1. Criar a tabela se ela ainda não existir inteiramente, 
-- ou apenas adicionar as colunas faltantes de acordo com o PRD.
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE,
  api_url TEXT,
  api_key TEXT,
  phone_number TEXT,
  status TEXT DEFAULT 'pending',
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Adicionar as colunas solicitadas no S4.1 (se a tabela já existia sem elas)
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS target_group_id TEXT,
  ADD COLUMN IF NOT EXISTS target_group_name TEXT,
  ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMPTZ;

-- 3. Criar os Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_org_id ON whatsapp_instances(org_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_client_id ON whatsapp_instances(client_id);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_instances_select_org"
  ON whatsapp_instances FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "whatsapp_instances_insert_org"
  ON whatsapp_instances FOR INSERT
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "whatsapp_instances_update_org"
  ON whatsapp_instances FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "whatsapp_instances_delete_org"
  ON whatsapp_instances FOR DELETE
  USING (org_id = auth_org_id());

CREATE TRIGGER trg_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();