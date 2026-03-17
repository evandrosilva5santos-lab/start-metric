-- Admin panel foundation: plans, user subscriptions, technical logs, problem reports and mock revenue

-- -----------------------------------------------------------------------------
-- 1) Helper function: admin role (owner/manager)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(public.current_user_role() IN ('owner', 'manager'), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) Core admin tables
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  description TEXT,
  price_monthly_mock NUMERIC(10,2),
  price_yearly_mock NUMERIC(10,2),
  features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mock BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_plans_org_code_unique UNIQUE (org_id, code),
  CONSTRAINT admin_plans_features_json_array CHECK (jsonb_typeof(features_json) = 'array'),
  CONSTRAINT admin_plans_limits_json_object CHECK (jsonb_typeof(limits_json) = 'object')
);

CREATE TABLE IF NOT EXISTS public.admin_user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.admin_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'paused', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  is_mock BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_user_subscriptions_org_user_unique UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.admin_user_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
  event TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  root_cause TEXT NOT NULL,
  detailed_analysis TEXT,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  stack_trace TEXT,
  request_id TEXT,
  source TEXT NOT NULL DEFAULT 'admin_panel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_user_logs_context_json_object CHECK (jsonb_typeof(context_json) = 'object')
);

CREATE TABLE IF NOT EXISTS public.admin_problem_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  log_id UUID REFERENCES public.admin_user_logs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
  symptom TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  detailed_analysis TEXT NOT NULL,
  impact TEXT NOT NULL,
  resolution_notes TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrences INTEGER NOT NULL DEFAULT 1 CHECK (occurrences >= 1),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_revenue_snapshots_mock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  mrr NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (mrr >= 0),
  arr NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (arr >= 0),
  churn_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (churn_rate >= 0),
  new_customers INTEGER NOT NULL DEFAULT 0 CHECK (new_customers >= 0),
  notes TEXT,
  is_mock BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_revenue_snapshots_mock_org_date_unique UNIQUE (org_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_admin_plans_org_id ON public.admin_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_subscriptions_org_id ON public.admin_user_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_subscriptions_user_id ON public.admin_user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_logs_org_id_created_at ON public.admin_user_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_user_logs_user_id ON public.admin_user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_logs_level ON public.admin_user_logs(level);
CREATE INDEX IF NOT EXISTS idx_admin_problem_reports_org_id_status ON public.admin_problem_reports(org_id, status);
CREATE INDEX IF NOT EXISTS idx_admin_problem_reports_user_id ON public.admin_problem_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_revenue_snapshots_mock_org_date ON public.admin_revenue_snapshots_mock(org_id, snapshot_date DESC);

-- -----------------------------------------------------------------------------
-- 3) updated_at trigger helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_plans_set_updated_at ON public.admin_plans;
CREATE TRIGGER trg_admin_plans_set_updated_at
BEFORE UPDATE ON public.admin_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS trg_admin_user_subscriptions_set_updated_at ON public.admin_user_subscriptions;
CREATE TRIGGER trg_admin_user_subscriptions_set_updated_at
BEFORE UPDATE ON public.admin_user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS trg_admin_problem_reports_set_updated_at ON public.admin_problem_reports;
CREATE TRIGGER trg_admin_problem_reports_set_updated_at
BEFORE UPDATE ON public.admin_problem_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_now();

-- -----------------------------------------------------------------------------
-- 4) RLS policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.admin_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_problem_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_revenue_snapshots_mock ENABLE ROW LEVEL SECURITY;

-- admin_plans
DROP POLICY IF EXISTS admin_plans_select_org ON public.admin_plans;
CREATE POLICY admin_plans_select_org
ON public.admin_plans
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS admin_plans_insert_admin ON public.admin_plans;
CREATE POLICY admin_plans_insert_admin
ON public.admin_plans
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_plans_update_admin ON public.admin_plans;
CREATE POLICY admin_plans_update_admin
ON public.admin_plans
FOR UPDATE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user())
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_plans_delete_admin ON public.admin_plans;
CREATE POLICY admin_plans_delete_admin
ON public.admin_plans
FOR DELETE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user());

-- admin_user_subscriptions
DROP POLICY IF EXISTS admin_user_subscriptions_select_org ON public.admin_user_subscriptions;
CREATE POLICY admin_user_subscriptions_select_org
ON public.admin_user_subscriptions
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS admin_user_subscriptions_insert_admin ON public.admin_user_subscriptions;
CREATE POLICY admin_user_subscriptions_insert_admin
ON public.admin_user_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_user_subscriptions_update_admin ON public.admin_user_subscriptions;
CREATE POLICY admin_user_subscriptions_update_admin
ON public.admin_user_subscriptions
FOR UPDATE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user())
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_user_subscriptions_delete_admin ON public.admin_user_subscriptions;
CREATE POLICY admin_user_subscriptions_delete_admin
ON public.admin_user_subscriptions
FOR DELETE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user());

-- admin_user_logs
DROP POLICY IF EXISTS admin_user_logs_select_org ON public.admin_user_logs;
CREATE POLICY admin_user_logs_select_org
ON public.admin_user_logs
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS admin_user_logs_insert_org ON public.admin_user_logs;
CREATE POLICY admin_user_logs_insert_org
ON public.admin_user_logs
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS admin_user_logs_update_admin ON public.admin_user_logs;
CREATE POLICY admin_user_logs_update_admin
ON public.admin_user_logs
FOR UPDATE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user())
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_user_logs_delete_admin ON public.admin_user_logs;
CREATE POLICY admin_user_logs_delete_admin
ON public.admin_user_logs
FOR DELETE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user());

-- admin_problem_reports
DROP POLICY IF EXISTS admin_problem_reports_select_org ON public.admin_problem_reports;
CREATE POLICY admin_problem_reports_select_org
ON public.admin_problem_reports
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS admin_problem_reports_insert_admin ON public.admin_problem_reports;
CREATE POLICY admin_problem_reports_insert_admin
ON public.admin_problem_reports
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_problem_reports_update_admin ON public.admin_problem_reports;
CREATE POLICY admin_problem_reports_update_admin
ON public.admin_problem_reports
FOR UPDATE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user())
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_problem_reports_delete_admin ON public.admin_problem_reports;
CREATE POLICY admin_problem_reports_delete_admin
ON public.admin_problem_reports
FOR DELETE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user());

-- admin_revenue_snapshots_mock
DROP POLICY IF EXISTS admin_revenue_snapshots_mock_select_org ON public.admin_revenue_snapshots_mock;
CREATE POLICY admin_revenue_snapshots_mock_select_org
ON public.admin_revenue_snapshots_mock
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS admin_revenue_snapshots_mock_insert_admin ON public.admin_revenue_snapshots_mock;
CREATE POLICY admin_revenue_snapshots_mock_insert_admin
ON public.admin_revenue_snapshots_mock
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_revenue_snapshots_mock_update_admin ON public.admin_revenue_snapshots_mock;
CREATE POLICY admin_revenue_snapshots_mock_update_admin
ON public.admin_revenue_snapshots_mock
FOR UPDATE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user())
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_user());

DROP POLICY IF EXISTS admin_revenue_snapshots_mock_delete_admin ON public.admin_revenue_snapshots_mock;
CREATE POLICY admin_revenue_snapshots_mock_delete_admin
ON public.admin_revenue_snapshots_mock
FOR DELETE
TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_user());

-- -----------------------------------------------------------------------------
-- 5) Realtime publication
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  target_table TEXT;
  target_tables TEXT[] := ARRAY[
    'admin_plans',
    'admin_user_subscriptions',
    'admin_user_logs',
    'admin_problem_reports',
    'admin_revenue_snapshots_mock'
  ];
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    FOREACH target_table IN ARRAY target_tables
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = target_table
          AND c.relkind = 'r'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = target_table
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          target_table
        );
      END IF;
    END LOOP;
  END IF;
END;
$$;
