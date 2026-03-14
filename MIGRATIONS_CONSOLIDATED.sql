-- ==== ALL 10 MIGRATIONS CONSOLIDATED ====
-- Apply in Supabase SQL Editor in order
-- ==== 20260307000000_init_sm_schema.sql ====
-- SCHEMA: sm (Start Metric) - ROI de Tempo e Organização
-- Prefix: sm_ (Start Metric)

-- 1. SETOR: IDENTITY & ACCESS (Acesso e Perfil)
CREATE TABLE IF NOT EXISTS sm_auth_profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sm_auth_profiles IS 'Dados estendidos de perfil do usuário vinculados ao Supabase Auth.';

-- 2. SETOR: META ADS (Conexão e Dados Brutos)
CREATE TABLE IF NOT EXISTS sm_meta_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    fb_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    token_status TEXT DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sm_meta_tokens IS 'Tokens de acesso à API do Facebook, isolados por usuário.';

CREATE TABLE IF NOT EXISTS sm_meta_accounts (
    id TEXT PRIMARY KEY, -- ID da Conta de Anúncios (act_...)
    token_id UUID REFERENCES sm_meta_tokens(id) ON DELETE CASCADE,
    name TEXT,
    currency TEXT,
    timezone_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sm_meta_accounts IS 'Contas de anúncios gerenciadas dentro do Start Metric.';

-- 3. SETOR: PERFORMANCE (Inteligência de Tráfego)
CREATE TABLE IF NOT EXISTS sm_perf_daily_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id TEXT REFERENCES sm_meta_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_spend NUMERIC(15,2) DEFAULT 0,
    total_impressions BIGINT DEFAULT 0,
    total_clicks BIGINT DEFAULT 0,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    roas NUMERIC(5,2) GENERATED ALWAYS AS (CASE WHEN total_spend > 0 THEN total_revenue / total_spend ELSE 0 END) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, date)
);

COMMENT ON TABLE sm_perf_daily_metrics IS 'Métricas agregadas por dia: o pulso do ROI do investimento em tráfego.';

-- 4. SETOR: ASSETS (Gestão de Criativos)
CREATE TABLE IF NOT EXISTS sm_asset_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id TEXT REFERENCES sm_meta_accounts(id) ON DELETE CASCADE,
    meta_asset_id TEXT NOT NULL,
    asset_type TEXT, -- image, video
    preview_url TEXT,
    cached_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sm_asset_registry IS 'Catálogo de criativos puxados da Meta API.';

-- ==== 20260307000001_multi_tenant_auth.sql ====
-- Fase 3: Auth + Multi-tenant base (ADR-005)

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'manager', 'analyst', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT org_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS organizations_select_by_membership ON public.organizations;
CREATE POLICY organizations_select_by_membership
ON public.organizations
FOR SELECT
TO authenticated
USING (id = public.current_org_id());

DROP POLICY IF EXISTS organizations_insert_authenticated ON public.organizations;
CREATE POLICY organizations_insert_authenticated
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS organizations_update_owner_only ON public.organizations;
CREATE POLICY organizations_update_owner_only
ON public.organizations
FOR UPDATE
TO authenticated
USING (
    id = public.current_org_id()
    AND public.current_user_role() = 'owner'
)
WITH CHECK (
    id = public.current_org_id()
    AND public.current_user_role() = 'owner'
);

DROP POLICY IF EXISTS profiles_select_same_org ON public.profiles;
CREATE POLICY profiles_select_same_org
ON public.profiles
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_self_or_manager ON public.profiles;
CREATE POLICY profiles_update_self_or_manager
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
    OR (
        org_id = public.current_org_id()
        AND public.current_user_role() IN ('owner', 'manager')
    )
)
WITH CHECK (
    id = auth.uid()
    OR (
        org_id = public.current_org_id()
        AND public.current_user_role() IN ('owner', 'manager')
    )
);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==== 20260307000002_meta_ads_tables.sql ====
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
DROP POLICY IF EXISTS "ad_accounts_select_org" ON ad_accounts;
CREATE POLICY "ad_accounts_select_org"
  ON ad_accounts FOR SELECT
  USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "ad_accounts_insert_org" ON ad_accounts;
CREATE POLICY "ad_accounts_insert_org"
  ON ad_accounts FOR INSERT
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "ad_accounts_update_org" ON ad_accounts;
CREATE POLICY "ad_accounts_update_org"
  ON ad_accounts FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "ad_accounts_delete_org" ON ad_accounts;
CREATE POLICY "ad_accounts_delete_org"
  ON ad_accounts FOR DELETE
  USING (org_id = auth_org_id());

-- CAMPAIGNS
DROP POLICY IF EXISTS "campaigns_select_org" ON campaigns;
CREATE POLICY "campaigns_select_org"
  ON campaigns FOR SELECT
  USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "campaigns_insert_org" ON campaigns;
CREATE POLICY "campaigns_insert_org"
  ON campaigns FOR INSERT
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "campaigns_update_org" ON campaigns;
CREATE POLICY "campaigns_update_org"
  ON campaigns FOR UPDATE
  USING (org_id = auth_org_id())
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "campaigns_delete_org" ON campaigns;
CREATE POLICY "campaigns_delete_org"
  ON campaigns FOR DELETE
  USING (org_id = auth_org_id());

-- DAILY METRICS
DROP POLICY IF EXISTS "daily_metrics_select_org" ON daily_metrics;
CREATE POLICY "daily_metrics_select_org"
  ON daily_metrics FOR SELECT
  USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "daily_metrics_insert_org" ON daily_metrics;
CREATE POLICY "daily_metrics_insert_org"
  ON daily_metrics FOR INSERT
  WITH CHECK (org_id = auth_org_id());

DROP POLICY IF EXISTS "daily_metrics_update_org" ON daily_metrics;
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

-- ==== 20260307000002_rls_and_triggers.sql ====
-- =============================================================================
-- Migration: 20260307000002_rls_and_triggers.sql
-- Description: RLS policies and auth/profile triggers
-- PostgreSQL 15 / Supabase compatible
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) ENABLE RLS ON CORE TABLES
-- -----------------------------------------------------------------------------
ALTER TABLE public.sm_auth_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_meta_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_meta_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_perf_daily_metrics ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2) POLICIES FOR sm_meta_tokens
--    - SELECT: user_id = auth.uid()
--    - INSERT: user_id = auth.uid()
--    - DELETE: user_id = auth.uid()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS sm_meta_tokens_select_own ON public.sm_meta_tokens;
CREATE POLICY sm_meta_tokens_select_own
ON public.sm_meta_tokens
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS sm_meta_tokens_insert_own ON public.sm_meta_tokens;
CREATE POLICY sm_meta_tokens_insert_own
ON public.sm_meta_tokens
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sm_meta_tokens_delete_own ON public.sm_meta_tokens;
CREATE POLICY sm_meta_tokens_delete_own
ON public.sm_meta_tokens
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) POLICIES FOR sm_auth_profiles
--    - SELECT/UPDATE: id = auth.uid()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS sm_auth_profiles_select_own ON public.sm_auth_profiles;
CREATE POLICY sm_auth_profiles_select_own
ON public.sm_auth_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS sm_auth_profiles_update_own ON public.sm_auth_profiles;
CREATE POLICY sm_auth_profiles_update_own
ON public.sm_auth_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4) TRIGGER TO AUTO-CREATE sm_auth_profiles ON auth.users INSERT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sm_handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sm_auth_profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sm_auth_user_created_profile ON auth.users;
CREATE TRIGGER trg_sm_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_sm_handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 5) updated_at TRIGGER FUNCTION FOR sm_auth_profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sm_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sm_auth_profiles_set_updated_at ON public.sm_auth_profiles;
CREATE TRIGGER trg_sm_auth_profiles_set_updated_at
BEFORE UPDATE ON public.sm_auth_profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sm_set_updated_at();

-- ==== 20260307000003_crypto_functions.sql ====
-- ============================================================
-- MIGRATION: Funções RPC de criptografia de tokens (ADR-006)
-- encrypt_token / decrypt_token via pgcrypto
-- SECURITY DEFINER: executam com privilégios do owner, não do caller.
-- A chave de criptografia é passada pelo server-side (nunca client).
-- ============================================================

-- Garante extensão pgcrypto disponível
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── encrypt_token ─────────────────────────────────────────────
-- Criptografa um access_token bruto com pgp_sym_encrypt.
-- Uso exclusivo server-side (lib/meta/token.ts).
CREATE OR REPLACE FUNCTION encrypt_token(
  raw_token       TEXT,
  encryption_key  TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT encode(
    pgp_sym_encrypt(raw_token, encryption_key)::bytea,
    'base64'
  );
$$;

COMMENT ON FUNCTION encrypt_token IS
  'Criptografa access_token com pgp_sym_encrypt(AES-256). '
  'SECURITY DEFINER — nunca chamar do client-side. '
  'Retorna base64 para armazenamento seguro em ad_accounts.token_encrypted.';

-- ── decrypt_token ─────────────────────────────────────────────
-- Descriptografa o token armazenado para uso em chamadas server-side.
-- Uso exclusivo server-side (lib/meta/token.ts → fetchCampaigns, etc).
CREATE OR REPLACE FUNCTION decrypt_token(
  encrypted_token TEXT,
  encryption_key  TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    encryption_key
  );
$$;

COMMENT ON FUNCTION decrypt_token IS
  'Descriptografa token armazenado em ad_accounts.token_encrypted. '
  'SECURITY DEFINER — nunca chamar do client-side. '
  'Recebe base64 gerado por encrypt_token e retorna o access_token bruto.';

-- ── Revogar acesso público às funções ─────────────────────────
-- Apenas funções server-side com a chave correta podem chamar.
REVOKE ALL ON FUNCTION encrypt_token(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION decrypt_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION encrypt_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_token(TEXT, TEXT) TO service_role;
-- anon/authenticated precisam chamar via API routes (nunca direto)
GRANT EXECUTE ON FUNCTION encrypt_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_token(TEXT, TEXT) TO authenticated;

-- ==== 20260307152000_auth_multitenant.sql ====
-- Fase 3: Auth + Multi-tenant base (ADR-005)
-- NOTE: organizations and profiles already created, this would be a duplicate
-- Skipping recreation to avoid conflicts

-- ==== 20260308193000_dashboard_perf_indexes.sql ====
-- Dashboard performance + timezone normalization (PRD seção 5 e 8)

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

CREATE INDEX IF NOT EXISTS idx_daily_metrics_org_date_campaign
ON public.daily_metrics (org_id, date DESC, campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_status_account
ON public.campaigns (org_id, status, ad_account_id);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_status
ON public.ad_accounts (org_id, status);

-- ==== 20260309090000_alerts_engine.sql ====
-- Alerts MVP engine (PRD 4.7)

CREATE TABLE IF NOT EXISTS public.notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN ('roas', 'cpa', 'spend_no_conversion')),
  operator TEXT NOT NULL CHECK (operator IN ('lt', 'gt', 'eq')),
  threshold NUMERIC(15,2) NOT NULL,
  channel TEXT NOT NULL DEFAULT 'web_push' CHECK (channel IN ('web_push')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.notification_rules(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  metric TEXT NOT NULL CHECK (metric IN ('roas', 'cpa', 'spend_no_conversion')),
  operator TEXT NOT NULL CHECK (operator IN ('lt', 'gt', 'eq')),
  threshold NUMERIC(15,2) NOT NULL,
  observed_value NUMERIC(15,2) NOT NULL,
  channel TEXT NOT NULL DEFAULT 'web_push' CHECK (channel IN ('web_push')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_org_active
ON public.notification_rules (org_id, active, metric);

CREATE INDEX IF NOT EXISTS idx_alerts_org_status_triggered
ON public.alerts (org_id, status, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_rule_campaign_recent
ON public.alerts (rule_id, campaign_id, triggered_at DESC);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_rules_select_org ON public.notification_rules;
CREATE POLICY notification_rules_select_org
ON public.notification_rules
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS notification_rules_insert_org ON public.notification_rules;
CREATE POLICY notification_rules_insert_org
ON public.notification_rules
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS notification_rules_update_org ON public.notification_rules;
CREATE POLICY notification_rules_update_org
ON public.notification_rules
FOR UPDATE
TO authenticated
USING (org_id = public.current_org_id())
WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS notification_rules_delete_org ON public.notification_rules;
CREATE POLICY notification_rules_delete_org
ON public.notification_rules
FOR DELETE
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS alerts_select_org ON public.alerts;
CREATE POLICY alerts_select_org
ON public.alerts
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS alerts_update_org ON public.alerts;
CREATE POLICY alerts_update_org
ON public.alerts
FOR UPDATE
TO authenticated
USING (org_id = public.current_org_id())
WITH CHECK (org_id = public.current_org_id());

CREATE OR REPLACE FUNCTION public.touch_alerts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_rules_updated_at ON public.notification_rules;
CREATE TRIGGER trg_notification_rules_updated_at
BEFORE UPDATE ON public.notification_rules
FOR EACH ROW
EXECUTE FUNCTION public.touch_alerts_updated_at();

-- ==== 20260314120000_auth_signup_bootstrap.sql ====
-- Auth signup hardening: add phone to profiles and bootstrap org/profile on new user

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE OR REPLACE FUNCTION public.fn_initialize_user_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_org_id UUID;
  derived_name TEXT;
  derived_phone TEXT;
  derived_org_name TEXT;
BEGIN
  derived_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  derived_phone := NULLIF(BTRIM(NEW.raw_user_meta_data->>'phone'), '');
  derived_org_name := COALESCE(NULLIF(derived_name, ''), 'Minha organizacao');

  SELECT org_id
  INTO target_org_id
  FROM public.profiles
  WHERE id = NEW.id
  LIMIT 1;

  IF target_org_id IS NULL THEN
    INSERT INTO public.organizations (name, plan)
    VALUES (derived_org_name, 'free')
    RETURNING id INTO target_org_id;
  END IF;

  INSERT INTO public.profiles (id, name, phone, org_id, role)
  VALUES (NEW.id, derived_name, derived_phone, target_org_id, 'owner')
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    org_id = COALESCE(public.profiles.org_id, EXCLUDED.org_id),
    role = COALESCE(public.profiles.role, EXCLUDED.role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initialize_user_account ON auth.users;
CREATE TRIGGER trg_initialize_user_account
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_initialize_user_account();

-- ==== 20260310110000_tracking_events.sql ====
-- Tracking events MVP (deduplicação por event_id)

CREATE TABLE IF NOT EXISTS public.tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL CHECK (event_name IN ('page_view', 'add_to_cart', 'checkout_start', 'purchase', 'custom')),
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id TEXT,
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  campaign_id TEXT,
  adset_id TEXT,
  ad_id TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  gclid TEXT,
  fbclid TEXT,
  ttclid TEXT,
  value NUMERIC(15, 2),
  currency TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_org_time
ON public.tracking_events (org_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_events_org_name_time
ON public.tracking_events (org_id, event_name, event_time DESC);

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracking_events_select_org ON public.tracking_events;
CREATE POLICY tracking_events_select_org
ON public.tracking_events
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS tracking_events_insert_org ON public.tracking_events;
CREATE POLICY tracking_events_insert_org
ON public.tracking_events
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_org_id());

-- ==== 20260310200000_sales_integration.sql ====
-- Migration: 20260310200000_sales_integration.sql
-- Create sales schema for orders and items

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (source in ('stripe', 'shopify', 'woocommerce', 'manual')),
  external_order_id text not null,
  status text not null,
  total_amount numeric(10,2) not null,
  currency text not null default 'BRL',
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_status text,
  tracking_session_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  attribution_fbc text,
  attribution_fbp text,
  click_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  UNIQUE(org_id, external_order_id, source)
);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id text,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_org_id ON public.sales_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON public.sales_orders(created_at);

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- ==== 20260314000000_auth_profile_bootstrap_trigger.sql ====
-- ============================================================
-- CRITICAL FIX: Auto-create organization and profile on signup
-- Fixes infinite loop on /auth/callback when profile doesn't exist
-- ============================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_name TEXT;
BEGIN
  -- Extract user name from metadata (signup form provides full_name)
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    'Usuário'
  );

  -- Create organization for new user
  INSERT INTO public.organizations (name, plan, timezone)
  VALUES (v_user_name || ' Organization', 'free', 'America/Sao_Paulo')
  RETURNING id INTO v_org_id;

  -- Create profile linking user to organization
  INSERT INTO public.profiles (id, name, org_id, role)
  VALUES (NEW.id, v_user_name, v_org_id, 'owner')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-bootstrap org + profile on signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.profiles TO authenticated;

-- ==== END OF ALL MIGRATIONS ====
