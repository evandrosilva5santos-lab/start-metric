-- Central de Histórico: controle da sincronização com a Meta (D12′, D20, D27, D36).
-- Uma execução por conta por vez (trava + batimento), cobertura por dia que nunca regride
-- e limite de uma sincronização manual a cada 5 min por conta.

CREATE TABLE IF NOT EXISTS public.activity_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('cron', 'manual')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'partial', 'failed', 'stale')),
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched integer NOT NULL DEFAULT 0 CHECK (fetched >= 0),
  inserted integer NOT NULL DEFAULT 0 CHECK (inserted >= 0),
  duplicates integer NOT NULL DEFAULT 0 CHECK (duplicates >= 0),
  error_code text CHECK (char_length(error_code) <= 64),
  error_message text CHECK (char_length(error_message) <= 500),
  CONSTRAINT activity_sync_runs_account_fk FOREIGN KEY (org_id, ad_account_id)
    REFERENCES public.ad_accounts (org_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS activity_sync_runs_one_running ON public.activity_sync_runs (ad_account_id)
  WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_activity_sync_runs_account ON public.activity_sync_runs (org_id, ad_account_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.activity_sync_coverage (
  org_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  day date NOT NULL,
  status text NOT NULL CHECK (status IN ('complete', 'partial', 'failed')),
  events integer NOT NULL DEFAULT 0 CHECK (events >= 0),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_account_id, day),
  CONSTRAINT activity_sync_coverage_account_fk FOREIGN KEY (org_id, ad_account_id)
    REFERENCES public.ad_accounts (org_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_activity_coverage_org_day ON public.activity_sync_coverage (org_id, day);

CREATE OR REPLACE FUNCTION public.activity_assert_account_in_org(p_org_id uuid, p_ad_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'ORG_REQUIRED' USING ERRCODE = '22004';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ad_accounts WHERE id = p_ad_account_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_IN_ORG' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.acquire_activity_sync_run(p_org_id uuid, p_ad_account_id uuid, p_trigger text)
RETURNS TABLE(run_id uuid, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.activity_assert_account_in_org(p_org_id, p_ad_account_id);
  IF p_trigger NOT IN ('cron', 'manual') THEN
    RAISE EXCEPTION 'INVALID_TRIGGER' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('activity_sync:' || p_ad_account_id::text));

  UPDATE public.activity_sync_runs
  SET status = 'stale', finished_at = now()
  WHERE ad_account_id = p_ad_account_id AND status = 'running' AND heartbeat_at < now() - interval '3 minutes';

  IF EXISTS (SELECT 1 FROM public.activity_sync_runs WHERE ad_account_id = p_ad_account_id AND status = 'running') THEN
    RETURN QUERY SELECT NULL::uuid, 'running'::text;
    RETURN;
  END IF;
  IF p_trigger = 'manual' AND EXISTS (
    SELECT 1 FROM public.activity_sync_runs
    WHERE ad_account_id = p_ad_account_id AND trigger = 'manual' AND started_at > now() - interval '5 minutes'
  ) THEN
    RETURN QUERY SELECT NULL::uuid, 'rate_limited'::text;
    RETURN;
  END IF;

  INSERT INTO public.activity_sync_runs (org_id, ad_account_id, trigger)
  VALUES (p_org_id, p_ad_account_id, p_trigger)
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, 'acquired'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_activity_sync_run(p_run_id uuid, p_fetched integer, p_inserted integer, p_duplicates integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.activity_sync_runs
  SET heartbeat_at = now(), fetched = p_fetched, inserted = p_inserted, duplicates = p_duplicates
  WHERE id = p_run_id AND status = 'running';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_activity_sync_run(
  p_run_id uuid, p_status text, p_fetched integer, p_inserted integer, p_duplicates integer,
  p_error_code text, p_error_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_status NOT IN ('succeeded', 'partial', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = '22023';
  END IF;
  UPDATE public.activity_sync_runs
  SET status = p_status, finished_at = now(), heartbeat_at = now(),
      fetched = p_fetched, inserted = p_inserted, duplicates = p_duplicates,
      error_code = left(p_error_code, 64), error_message = left(p_error_message, 500)
  WHERE id = p_run_id AND status = 'running';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_activity_coverage(
  p_org_id uuid, p_ad_account_id uuid, p_day date, p_status text, p_events integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.activity_assert_account_in_org(p_org_id, p_ad_account_id);
  IF p_status NOT IN ('complete', 'partial', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.activity_sync_coverage AS c (org_id, ad_account_id, day, status, events, fetched_at)
  VALUES (p_org_id, p_ad_account_id, p_day, p_status, greatest(p_events, 0), now())
  ON CONFLICT (ad_account_id, day) DO UPDATE
  SET status = CASE WHEN c.status = 'complete' AND EXCLUDED.status <> 'complete' THEN 'complete' ELSE EXCLUDED.status END,
      events = CASE WHEN c.status = 'complete' AND EXCLUDED.status <> 'complete' THEN c.events ELSE EXCLUDED.events END,
      fetched_at = now();
END;
$$;

ALTER TABLE public.activity_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sync_coverage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_sync_runs_select_own_org ON public.activity_sync_runs;
CREATE POLICY activity_sync_runs_select_own_org ON public.activity_sync_runs
  FOR SELECT TO authenticated USING (org_id = (SELECT public.auth_org_id()));
DROP POLICY IF EXISTS activity_coverage_select_own_org ON public.activity_sync_coverage;
CREATE POLICY activity_coverage_select_own_org ON public.activity_sync_coverage
  FOR SELECT TO authenticated USING (org_id = (SELECT public.auth_org_id()));

REVOKE ALL ON public.activity_sync_runs, public.activity_sync_coverage FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.activity_sync_runs, public.activity_sync_coverage TO authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.activity_assert_account_in_org(uuid, uuid),
  public.acquire_activity_sync_run(uuid, uuid, text),
  public.heartbeat_activity_sync_run(uuid, integer, integer, integer),
  public.finish_activity_sync_run(uuid, text, integer, integer, integer, text, text),
  public.record_activity_coverage(uuid, uuid, date, text, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.acquire_activity_sync_run(uuid, uuid, text),
  public.heartbeat_activity_sync_run(uuid, integer, integer, integer),
  public.finish_activity_sync_run(uuid, text, integer, integer, integer, text, text),
  public.record_activity_coverage(uuid, uuid, date, text, integer)
TO service_role;
