-- Google Ads: conexão por org, campanhas e métricas diárias.
-- Contas ficam em ad_accounts (platform = 'google', external_id = id de 10 dígitos);
-- métricas em tabelas próprias para não misturar com as telas da Meta.
-- Escrita só pelo servidor (service role); o painel lê só a própria org e nunca lê as conexões.

CREATE TABLE IF NOT EXISTS public.google_ads_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('service_account', 'oauth')),
  login_customer_id text CHECK (login_customer_id ~ '^[0-9]{10}$'),
  refresh_token_encrypted text,
  google_email text CHECK (char_length(google_email) <= 320),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error')),
  last_error_code text CHECK (char_length(last_error_code) <= 64),
  last_error text CHECK (char_length(last_error) <= 500),
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_connections_org_mode UNIQUE (org_id, mode),
  CONSTRAINT google_ads_oauth_requires_token CHECK (mode <> 'oauth' OR refresh_token_encrypted IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.google_ads_campaigns (
  org_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  campaign_id text NOT NULL CHECK (campaign_id ~ '^[0-9]+$'),
  name text NOT NULL CHECK (char_length(name) <= 500),
  status text,
  channel_type text,
  channel_sub_type text,
  bidding_strategy_type text,
  budget_micros bigint,
  budget_period text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_account_id, campaign_id),
  CONSTRAINT google_ads_campaigns_account_fk FOREIGN KEY (org_id, ad_account_id)
    REFERENCES public.ad_accounts (org_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_google_campaigns_org ON public.google_ads_campaigns (org_id, ad_account_id);

CREATE TABLE IF NOT EXISTS public.google_ads_daily_metrics (
  org_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  campaign_id text NOT NULL CHECK (campaign_id ~ '^[0-9]+$'),
  date date NOT NULL,
  cost_micros bigint NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  impressions bigint NOT NULL DEFAULT 0 CHECK (impressions >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  conversions numeric(16, 4) NOT NULL DEFAULT 0,
  conversions_value numeric(18, 4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_account_id, campaign_id, date),
  CONSTRAINT google_ads_metrics_account_fk FOREIGN KEY (org_id, ad_account_id)
    REFERENCES public.ad_accounts (org_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_google_metrics_org_date ON public.google_ads_daily_metrics (org_id, date);
CREATE INDEX IF NOT EXISTS idx_google_metrics_account_date ON public.google_ads_daily_metrics (org_id, ad_account_id, date);

ALTER TABLE public.google_ads_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_campaigns_select_own_org ON public.google_ads_campaigns;
CREATE POLICY google_campaigns_select_own_org ON public.google_ads_campaigns
  FOR SELECT TO authenticated USING (org_id = (SELECT public.auth_org_id()));
DROP POLICY IF EXISTS google_metrics_select_own_org ON public.google_ads_daily_metrics;
CREATE POLICY google_metrics_select_own_org ON public.google_ads_daily_metrics
  FOR SELECT TO authenticated USING (org_id = (SELECT public.auth_org_id()));

REVOKE ALL ON public.google_ads_connections, public.google_ads_campaigns, public.google_ads_daily_metrics
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.google_ads_campaigns, public.google_ads_daily_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_connections, public.google_ads_campaigns,
  public.google_ads_daily_metrics TO service_role;
