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
