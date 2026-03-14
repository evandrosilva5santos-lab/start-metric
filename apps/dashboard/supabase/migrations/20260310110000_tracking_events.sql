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
