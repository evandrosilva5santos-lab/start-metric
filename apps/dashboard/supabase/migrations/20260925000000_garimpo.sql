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
