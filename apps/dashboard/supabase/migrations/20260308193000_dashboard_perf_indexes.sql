-- Dashboard performance + timezone normalization (PRD seção 5 e 8)

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

CREATE INDEX IF NOT EXISTS idx_daily_metrics_org_date_campaign
ON public.daily_metrics (org_id, date DESC, campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_status_account
ON public.campaigns (org_id, status, ad_account_id);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_status
ON public.ad_accounts (org_id, status);
