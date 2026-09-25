-- ============================================================
-- START METRIC · CORREÇÃO DO BANCO (pode rodar quantas vezes quiser)
--
-- Cole tudo no Supabase > SQL Editor > New query > Run.
-- Cria só o que falta; o que já existe fica como está.
--
--   1. Clientes (tabela, RLS e ligação com as contas de anúncio)
--   2. Nicho do cliente
--   3. Soma das métricas do painel (dashboard_metrics_rollup)
--   4. Garimpo (ofertas, páginas, anúncios, varreduras, cortes, curva)
--   5. Conferência no final
-- ============================================================

-- Pré-requisitos (já existem se as migrações de março foram aplicadas)
DO $$ BEGIN
  IF to_regprocedure('public.auth_org_id()') IS NULL THEN
    RAISE EXCEPTION 'Falta a função auth_org_id(). Aplique antes a migração 20260307000002_meta_ads_tables.sql.';
  END IF;
  IF to_regclass('public.ad_accounts') IS NULL OR to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'Faltam as tabelas organizations/ad_accounts. Aplique antes as migrações de 20260307.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. CLIENTES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  whatsapp    TEXT,
  logo_url    TEXT,
  notes       TEXT,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_own_org" ON public.clients;
CREATE POLICY "clients_select_own_org" ON public.clients FOR SELECT USING (org_id = auth_org_id());
DROP POLICY IF EXISTS "clients_insert_own_org" ON public.clients;
CREATE POLICY "clients_insert_own_org" ON public.clients FOR INSERT WITH CHECK (org_id = auth_org_id());
DROP POLICY IF EXISTS "clients_update_own_org" ON public.clients;
CREATE POLICY "clients_update_own_org" ON public.clients FOR UPDATE USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id());
DROP POLICY IF EXISTS "clients_delete_own_org" ON public.clients;
CREATE POLICY "clients_delete_own_org" ON public.clients FOR DELETE USING (org_id = auth_org_id());

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS idx_clients_archived_at ON public.clients(archived_at) WHERE archived_at IS NULL;

-- Cada conta de anúncio pertence a no máximo um cliente.
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ad_accounts_client_id ON public.ad_accounts(client_id);

-- ============================================================
-- 2. NICHO DO CLIENTE
-- ============================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS niche TEXT;
CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_client ON public.ad_accounts (org_id, client_id);

-- ============================================================
-- 3. SOMA DAS MÉTRICAS DO PAINEL
-- ============================================================

-- Dashboard: soma das métricas no banco
--
-- Antes o painel baixava todas as linhas de daily_metrics do período
-- (campanhas × dias) e somava em JS. Esta função devolve só os totais:
-- uma linha por campanha e uma linha por dia.
--
-- SECURITY INVOKER: a RLS de daily_metrics (org_id = auth_org_id())
-- continua valendo; o filtro por org_id aqui é só para usar o índice.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_daily_metrics_org_date
  ON daily_metrics (org_id, date);

CREATE OR REPLACE FUNCTION public.dashboard_metrics_rollup(
  p_org_id       UUID,
  p_from         DATE,
  p_to           DATE,
  p_campaign_ids UUID[]
)
RETURNS TABLE (
  kind        TEXT,
  key         TEXT,
  spend       NUMERIC,
  revenue     NUMERIC,
  conversions BIGINT,
  impressions BIGINT,
  clicks      BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT dm.campaign_id, dm.date, dm.spend, dm.revenue_attributed,
           dm.conversions, dm.impressions, dm.clicks
    FROM daily_metrics dm
    WHERE dm.org_id = p_org_id
      AND dm.date BETWEEN p_from AND p_to
      AND dm.campaign_id = ANY (p_campaign_ids)
  )
  SELECT 'campaign'::TEXT, campaign_id::TEXT,
         COALESCE(SUM(spend), 0), COALESCE(SUM(revenue_attributed), 0),
         COALESCE(SUM(conversions), 0)::BIGINT, COALESCE(SUM(impressions), 0)::BIGINT,
         COALESCE(SUM(clicks), 0)::BIGINT
  FROM scoped
  GROUP BY campaign_id
  UNION ALL
  SELECT 'day'::TEXT, date::TEXT,
         COALESCE(SUM(spend), 0), COALESCE(SUM(revenue_attributed), 0),
         COALESCE(SUM(conversions), 0)::BIGINT, COALESCE(SUM(impressions), 0)::BIGINT,
         COALESCE(SUM(clicks), 0)::BIGINT
  FROM scoped
  GROUP BY date;
$$;

REVOKE ALL ON FUNCTION public.dashboard_metrics_rollup(UUID, DATE, DATE, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics_rollup(UUID, DATE, DATE, UUID[]) TO authenticated;

-- ============================================================
-- 4. GARIMPO
-- ============================================================
-- ============================================================
-- Garimpo: quem está gastando num nicho, agrupado por domínio de destino
--
-- A unidade é o domínio (garimpo_offers). Páginas são descartáveis e
-- apontam para uma oferta; anúncios pertencem a uma página.
-- Tudo com org_id + RLS (org_id = auth_org_id()).
-- ============================================================

DO $$ BEGIN
  CREATE TYPE garimpo_offer_status AS ENUM ('novo', 'em_analise', 'aprovado', 'descartado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE garimpo_run_source AS ENUM ('api_oficial', 'terceiro', 'scraper_proprio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OFFERS (uma por domínio registrável, por organização)
CREATE TABLE IF NOT EXISTS garimpo_offers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain        TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        garimpo_offer_status NOT NULL DEFAULT 'novo',
  watch         BOOLEAN NOT NULL DEFAULT false,
  score         NUMERIC,
  score_parts   JSONB,
  niche         TEXT,
  country       TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_garimpo_offers_org_status ON garimpo_offers (org_id, status, score DESC);
CREATE INDEX IF NOT EXISTS idx_garimpo_offers_watch ON garimpo_offers (watch) WHERE watch;

-- OFFER_DOMAINS (cada link bruto visto e para onde ele leva)
CREATE TABLE IF NOT EXISTS garimpo_offer_domains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_id        UUID NOT NULL REFERENCES garimpo_offers(id) ON DELETE CASCADE,
  raw_link        TEXT NOT NULL,
  displayed_domain TEXT,
  redirect_chain  TEXT[] NOT NULL DEFAULT '{}',
  resolved_domain TEXT,
  divergent       BOOLEAN NOT NULL DEFAULT false,
  resolve_error   TEXT,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (offer_id, raw_link)
);

CREATE INDEX IF NOT EXISTS idx_garimpo_offer_domains_org ON garimpo_offer_domains (org_id, offer_id);

-- PAGES
CREATE TABLE IF NOT EXISTS garimpo_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_id      UUID NOT NULL REFERENCES garimpo_offers(id) ON DELETE CASCADE,
  page_id_meta  TEXT NOT NULL,
  page_name     TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, offer_id, page_id_meta)
);

CREATE INDEX IF NOT EXISTS idx_garimpo_pages_offer ON garimpo_pages (offer_id);

-- ADS
CREATE TABLE IF NOT EXISTS garimpo_ads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id        UUID NOT NULL REFERENCES garimpo_pages(id) ON DELETE CASCADE,
  offer_id       UUID NOT NULL REFERENCES garimpo_offers(id) ON DELETE CASCADE,
  ad_archive_id  TEXT NOT NULL,
  started_at     TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  creative_hash  TEXT,
  hash_kind      TEXT CHECK (hash_kind IN ('phash', 'fingerprint')),
  media_url      TEXT,
  body_text      TEXT,
  cta            TEXT,
  format         TEXT,
  captured_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_garimpo_ads_org_archive ON garimpo_ads (org_id, ad_archive_id);
CREATE INDEX IF NOT EXISTS idx_garimpo_ads_offer_hash ON garimpo_ads (offer_id, creative_hash);

-- RUNS (cada varredura, com fonte, volume e bloqueio)
CREATE TABLE IF NOT EXISTS garimpo_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  niche             TEXT,
  country           TEXT,
  source            garimpo_run_source NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  ads_read          INT,
  domains_found     INT,
  status            TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'ok', 'blocked', 'error', 'not_configured', 'unavailable')),
  error_text        TEXT,
  cost_per_thousand NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_garimpo_runs_org_started ON garimpo_runs (org_id, started_at DESC);

-- CUTS (um corte por organização)
CREATE TABLE IF NOT EXISTS garimpo_cuts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  min_ads    INT NOT NULL DEFAULT 5,
  min_days   INT NOT NULL DEFAULT 7,
  min_pages  INT NOT NULL DEFAULT 2,
  formats    TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OFFER_DAILY (a curva cresce um ponto por dia)
CREATE TABLE IF NOT EXISTS garimpo_offer_daily (
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_id   UUID NOT NULL REFERENCES garimpo_offers(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  active_ads INT NOT NULL,
  pages      INT NOT NULL,
  PRIMARY KEY (offer_id, day)
);

CREATE INDEX IF NOT EXISTS idx_garimpo_offer_daily_org ON garimpo_offer_daily (org_id, day);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE garimpo_offers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE garimpo_offer_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE garimpo_pages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE garimpo_ads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE garimpo_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE garimpo_cuts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE garimpo_offer_daily   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'garimpo_offers', 'garimpo_offer_domains', 'garimpo_pages', 'garimpo_ads',
    'garimpo_runs', 'garimpo_cuts', 'garimpo_offer_daily'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_org', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (org_id = auth_org_id())', t || '_select_org', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert_org', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (org_id = auth_org_id())', t || '_insert_org', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update_org', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (org_id = auth_org_id()) WITH CHECK (org_id = auth_org_id())', t || '_update_org', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete_org', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (org_id = auth_org_id())', t || '_delete_org', t);
  END LOOP;
END $$;


-- ============================================================
-- 5. CONFERÊNCIA — todas as linhas devem vir com "ok"
-- ============================================================
SELECT item, CASE WHEN existe THEN 'ok' ELSE 'FALTANDO' END AS situacao
FROM (VALUES
  ('tabela clients',                 to_regclass('public.clients') IS NOT NULL),
  ('coluna clients.niche',           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='niche')),
  ('coluna ad_accounts.client_id',   EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ad_accounts' AND column_name='client_id')),
  ('função dashboard_metrics_rollup', to_regprocedure('public.dashboard_metrics_rollup(uuid,date,date,uuid[])') IS NOT NULL),
  ('tabela garimpo_offers',          to_regclass('public.garimpo_offers') IS NOT NULL),
  ('tabela garimpo_ads',             to_regclass('public.garimpo_ads') IS NOT NULL),
  ('tabela garimpo_offer_daily',     to_regclass('public.garimpo_offer_daily') IS NOT NULL)
) AS t(item, existe);
