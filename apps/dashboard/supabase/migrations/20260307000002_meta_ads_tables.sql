-- ============================================================
-- MIGRATION: Meta Ads Tables (ADR-005 + ADR-006)
-- Start Metric — ad_accounts, campaigns, daily_metrics
-- ============================================================

-- Garantir pgcrypto disponível
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. AD ACCOUNTS
-- Uma conta de anúncios por token OAuth Meta.
-- token_encrypted usa pgp_sym_encrypt (chave via env server-side).
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform         TEXT        NOT NULL DEFAULT 'meta',
  external_id      TEXT        NOT NULL,               -- act_XXXXXXX
  name             TEXT,
  currency         TEXT,
  timezone         TEXT,
  token_encrypted  TEXT        NOT NULL,               -- pgp_sym_encrypt output
  token_expires_at TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'active',  -- active | expired | disconnected
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, external_id),
  CONSTRAINT ad_accounts_status_check CHECK (status IN ('active', 'expired', 'disconnected'))
);

COMMENT ON TABLE ad_accounts IS
  'Contas de anúncios de terceiros (Meta, Google) vinculadas a uma organização. Token armazenado criptografado (ADR-006).';
COMMENT ON COLUMN ad_accounts.token_encrypted IS
  'Access token criptografado com pgp_sym_encrypt usando SUPABASE_ENCRYPTION_KEY. NUNCA descriptografar no client-side.';

-- ============================================================
-- 2. CAMPAIGNS
-- Campanhas sincronizadas da Meta Graph API.
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id             UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id  UUID      NOT NULL REFERENCES ad_accounts(id) ON DELETE CASCADE,
  org_id         UUID      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meta_id        TEXT      NOT NULL,    -- ID nativo Meta (numérico)
  name           TEXT      NOT NULL,
  status         TEXT,                  -- ACTIVE | PAUSED | ARCHIVED | DELETED
  objective      TEXT,                  -- OUTCOME_SALES | OUTCOME_LEADS | etc.
  daily_budget   NUMERIC(15,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(ad_account_id, meta_id)
);

COMMENT ON TABLE campaigns IS
  'Campanhas sincronizadas da Meta Ads API. Sempre isoladas por org_id (ADR-005).';

-- ============================================================
-- 3. DAILY METRICS
-- Métricas agregadas por campanha/dia.
-- revenue_attributed = soma das conversions × valor reportado pela Meta.
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_metrics (
  id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID      NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id              UUID      NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date                DATE      NOT NULL,
  spend               NUMERIC(15,2) DEFAULT 0,
  impressions         BIGINT        DEFAULT 0,
  clicks              BIGINT        DEFAULT 0,
  conversions         INT           DEFAULT 0,
  revenue_attributed  NUMERIC(15,2) DEFAULT 0,
  -- ROAS calculado no momento da consulta para evitar stale data
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE(campaign_id, date)
);

COMMENT ON TABLE daily_metrics IS
  'Métricas diárias por campanha. UNIQUE(campaign_id, date) — upsert seguro.';

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_id    ON ad_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id       ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_ad_account   ON campaigns(ad_account_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_org_id   ON daily_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_campaign ON daily_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date     ON daily_metrics(date DESC);

-- ============================================================
-- RLS — Row Level Security (ADR-005)
-- Isolamento completo por org_id.
-- ============================================================

ALTER TABLE ad_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- Helper inline: org do usuário autenticado
-- (evita sub-select repetido em cada policy)
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

-- AD ACCOUNTS
CREATE POLICY "ad_accounts_select_org"
  ON ad_accounts FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "ad_accounts_insert_org"
  ON ad_accounts FOR INSERT
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "ad_accounts_update_org"
  ON ad_accounts FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "ad_accounts_delete_org"
  ON ad_accounts FOR DELETE
  USING (org_id = auth_org_id());

-- CAMPAIGNS
CREATE POLICY "campaigns_select_org"
  ON campaigns FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "campaigns_insert_org"
  ON campaigns FOR INSERT
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "campaigns_update_org"
  ON campaigns FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "campaigns_delete_org"
  ON campaigns FOR DELETE
  USING (org_id = auth_org_id());

-- DAILY METRICS
CREATE POLICY "daily_metrics_select_org"
  ON daily_metrics FOR SELECT
  USING (org_id = auth_org_id());

CREATE POLICY "daily_metrics_insert_org"
  ON daily_metrics FOR INSERT
  WITH CHECK (org_id = auth_org_id());

CREATE POLICY "daily_metrics_update_org"
  ON daily_metrics FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ad_accounts_updated_at
  BEFORE UPDATE ON ad_accounts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
