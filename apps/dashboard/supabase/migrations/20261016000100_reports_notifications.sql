-- ============================================================
-- Relatórios, alertas com template e leads
-- Ref.: docs/PLANO_RELATORIOS_NOTIFICACOES.md §4
--
-- Banco compartilhado: só cria tabelas novas e adiciona colunas nulas.
-- Re-executável (IF NOT EXISTS / DROP ... IF EXISTS).
-- RLS por org_id com auth_org_id(), mesmo helper das policies de clients.
-- report_runs: usuário só lê; escrita é do service role (cron / "gerar agora"),
-- exceto a esteira de entrega, via register_report_delivery().
-- message_templates com org_id NULL só são criados pelo service role.
-- Fora de escopo: colunas de WhatsApp.
-- ============================================================

SET lock_timeout = '5s';

-- ------------------------------------------------------------
-- 0. Helpers
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reports_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Impede referência a cliente/conta/webhook de outra organização.
-- SECURITY INVOKER: sob RLS o usuário só enxerga a própria org; com
-- service role a comparação explícita de org_id faz o mesmo papel.
CREATE OR REPLACE FUNCTION public.reports_assert_same_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  rec        JSONB := to_jsonb(NEW);
  v_org      UUID;
  v_client   UUID := NULLIF(rec->>'client_id', '')::uuid;
  v_account  UUID := NULLIF(rec->>'ad_account_id', '')::uuid;
  v_webhook  UUID := NULLIF(rec->>'webhook_id', '')::uuid;
BEGIN
  IF TG_TABLE_NAME = 'report_parts' THEN
    SELECT r.org_id, r.client_id INTO v_org, v_client
    FROM public.reports r WHERE r.id = (rec->>'report_id')::uuid;
  ELSE
    v_org := (rec->>'org_id')::uuid;
  END IF;

  IF v_client IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = v_client AND c.org_id = v_org
  ) THEN
    RAISE EXCEPTION 'client_id % não pertence à organização', v_client USING ERRCODE = '23503';
  END IF;

  IF v_account IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ad_accounts a WHERE a.id = v_account AND a.org_id = v_org
  ) THEN
    RAISE EXCEPTION 'ad_account_id % não pertence à organização', v_account USING ERRCODE = '23503';
  END IF;

  IF v_account IS NOT NULL AND v_client IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ad_accounts a
    WHERE a.id = v_account AND a.client_id IS NOT NULL AND a.client_id <> v_client
  ) THEN
    RAISE EXCEPTION 'ad_account_id % pertence a outro cliente', v_account USING ERRCODE = '23503';
  END IF;

  IF v_webhook IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lead_webhooks w WHERE w.id = v_webhook AND w.org_id = v_org
  ) THEN
    RAISE EXCEPTION 'webhook_id % não pertence à organização', v_webhook USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 1. message_templates (org_id NULL = template do sistema)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  context     TEXT NOT NULL CHECK (context IN ('report', 'alert', 'lead')),
  objective   TEXT,
  channel     TEXT,
  name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_org_context
  ON public.message_templates (org_id, context);

-- ------------------------------------------------------------
-- 2. reports (agendamento como colunas, D4)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft')),
  frequency    TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  send_time    TIME NOT NULL DEFAULT '08:00',
  weekday      SMALLINT CHECK (weekday BETWEEN 0 AND 6),
  month_day    SMALLINT CHECK (month_day BETWEEN 1 AND 31),
  timezone     TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  next_run_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reports_id_org_key UNIQUE (id, org_id),
  CONSTRAINT reports_weekly_has_weekday CHECK (frequency <> 'weekly' OR weekday IS NOT NULL),
  CONSTRAINT reports_monthly_has_month_day CHECK (frequency <> 'monthly' OR month_day IS NOT NULL),
  CONSTRAINT reports_active_has_next_run CHECK (status <> 'active' OR next_run_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_reports_org ON public.reports (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_client ON public.reports (client_id);
CREATE INDEX IF NOT EXISTS idx_reports_due
  ON public.reports (next_run_at) WHERE status = 'active';

-- ------------------------------------------------------------
-- 3. report_parts (sem org_id; isolamento via reports)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_parts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id          UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  position           INT NOT NULL CHECK (position >= 0),
  ad_account_id      UUID REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  period             TEXT NOT NULL DEFAULT 'yesterday'
                     CHECK (period IN ('yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month', 'custom')),
  custom_start       DATE,
  custom_end         DATE,
  body               TEXT NOT NULL,
  send_without_data  BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT report_parts_report_position_key UNIQUE (report_id, position),
  CONSTRAINT report_parts_custom_range CHECK (
    period <> 'custom'
    OR (custom_start IS NOT NULL AND custom_end IS NOT NULL AND custom_start <= custom_end)
  )
);

CREATE INDEX IF NOT EXISTS idx_report_parts_ad_account ON public.report_parts (ad_account_id);

-- ------------------------------------------------------------
-- 4. report_runs (idempotência por report_id + scheduled_for)
-- FK composta garante run.org_id = report.org_id.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.report_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id          UUID NOT NULL,
  scheduled_for      TIMESTAMPTZ NOT NULL,
  status             TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued', 'generated', 'sent', 'received', 'approved', 'failed', 'skipped')),
  rendered_body      TEXT,
  missing_variables  TEXT[] NOT NULL DEFAULT '{}',
  error_message      TEXT,
  started_at         TIMESTAMPTZ,
  finished_at        TIMESTAMPTZ,
  sent_at            TIMESTAMPTZ,
  received_at        TIMESTAMPTZ,
  approved_at        TIMESTAMPTZ,
  sent_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  delivery_note      TEXT CHECK (length(delivery_note) <= 2000),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT report_runs_report_fkey FOREIGN KEY (report_id, org_id)
    REFERENCES public.reports (id, org_id) ON DELETE CASCADE,
  CONSTRAINT report_runs_report_scheduled_key UNIQUE (report_id, scheduled_for),
  CONSTRAINT report_runs_delivery_order CHECK (
    (received_at IS NULL OR (sent_at IS NOT NULL AND received_at >= sent_at))
    AND (approved_at IS NULL OR (received_at IS NOT NULL AND approved_at >= received_at))
    AND (status NOT IN ('sent', 'received', 'approved') OR sent_at IS NOT NULL)
    AND (status NOT IN ('received', 'approved') OR received_at IS NOT NULL)
    AND (status <> 'approved' OR approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_report_runs_org_created ON public.report_runs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_runs_sent_by ON public.report_runs (sent_by);

-- Esteira de entrega (gerado → enviado → recebido → aprovado) registrada pelo usuário.
CREATE OR REPLACE FUNCTION public.register_report_delivery(
  p_run_id UUID,
  p_step   TEXT,
  p_note   TEXT DEFAULT NULL
)
RETURNS public.report_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_org      UUID := public.auth_org_id();
  v_run      public.report_runs;
  v_previous TEXT;
  v_note     TEXT := NULLIF(btrim(p_note), '');
BEGIN
  IF v_uid IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;

  v_previous := CASE p_step
    WHEN 'sent' THEN 'generated'
    WHEN 'received' THEN 'sent'
    WHEN 'approved' THEN 'received'
  END;
  IF v_previous IS NULL THEN
    RAISE EXCEPTION 'passo inválido: %', p_step USING ERRCODE = '22023';
  END IF;

  IF length(v_note) > 2000 THEN
    RAISE EXCEPTION 'nota excede 2000 caracteres' USING ERRCODE = '22001';
  END IF;

  SELECT * INTO v_run FROM public.report_runs
  WHERE id = p_run_id AND org_id = v_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'relatório gerado não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_run.status <> v_previous THEN
    RAISE EXCEPTION 'passo % exige estado %, atual %', p_step, v_previous, v_run.status
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.report_runs SET
    status        = p_step,
    sent_at       = CASE WHEN p_step = 'sent' THEN now() ELSE sent_at END,
    sent_by       = CASE WHEN p_step = 'sent' THEN v_uid ELSE sent_by END,
    received_at   = CASE WHEN p_step = 'received' THEN now() ELSE received_at END,
    approved_at   = CASE WHEN p_step = 'approved' THEN now() ELSE approved_at END,
    delivery_note = COALESCE(v_note, delivery_note)
  WHERE id = v_run.id
  RETURNING * INTO v_run;

  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.register_report_delivery(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_report_delivery(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_report_delivery(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 4b. alerts: triagem (status continua unread/read até o código mudar)
-- ------------------------------------------------------------

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS severity        TEXT CHECK (severity IN ('critical', 'warning', 'info')),
  ADD COLUMN IF NOT EXISTS assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

CREATE INDEX IF NOT EXISTS idx_alerts_assigned_to ON public.alerts (assigned_to);

-- ------------------------------------------------------------
-- 5. notification_rules: colunas novas e nulas
-- ------------------------------------------------------------

ALTER TABLE public.notification_rules
  ADD COLUMN IF NOT EXISTS client_id     UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ad_account_id UUID REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS template_body TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_rules_client ON public.notification_rules (client_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_ad_account ON public.notification_rules (ad_account_id);

-- metric passa a aceitar balance_below, ctr_below, api_error.
-- Só alarga um CHECK que já exista (preserva os valores atuais dele);
-- se não houver CHECK, nada é criado. alerts.metric copia o metric da
-- regra, então recebe o mesmo tratamento.
DO $$
DECLARE
  t         TEXT;
  c         RECORD;
  vals      TEXT[];
  old_names TEXT[];
  tmp_name  TEXT;
  final     TEXT;
  new_vals  CONSTANT TEXT[] := ARRAY['balance_below', 'ctr_below', 'api_error'];
BEGIN
  FOREACH t IN ARRAY ARRAY['notification_rules', 'alerts'] LOOP
    vals := NULL;
    old_names := '{}';
    final := t || '_metric_check';
    tmp_name := final || '_widened';

    FOR c IN
      SELECT con.conname, pg_get_constraintdef(con.oid) AS def,
             (cardinality(con.conkey) = 1
              AND pg_get_constraintdef(con.oid) ~* 'ANY \((ARRAY\[|''\{)') AS is_list
      FROM pg_constraint con
      WHERE con.conrelid = format('public.%I', t)::regclass
        AND con.contype = 'c'
        AND con.conname <> tmp_name
        AND EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey) AND a.attname = 'metric'
        )
    LOOP
      IF NOT c.is_list THEN
        RAISE EXCEPTION 'CHECK % em %.metric tem formato inesperado (%); alargar manualmente', c.conname, t, c.def;
      END IF;
      vals := COALESCE(vals, '{}'::text[]) || CASE
        WHEN c.def ~ '''\{' THEN string_to_array((regexp_match(c.def, '''\{([^}]*)\}'''))[1], ',')
        ELSE ARRAY(SELECT m[1] FROM regexp_matches(c.def, '''([^'']+)''', 'g') AS m)
      END;
      old_names := old_names || c.conname::text;
    END LOOP;

    IF vals IS NOT NULL THEN
      vals := ARRAY(SELECT DISTINCT v FROM unnest(vals || new_vals) AS v ORDER BY v);
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, tmp_name);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (metric = ANY (%L::text[])) NOT VALID',
        t, tmp_name, vals
      );
      EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', t, tmp_name);
      FOR i IN 1 .. cardinality(old_names) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, old_names[i]);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', t, tmp_name, final);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 6. lead_webhooks e leads (só tabelas; webhook fica para N2)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lead_webhooks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id      UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name           TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  token          UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  provider       TEXT,
  template_body  TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_webhooks_org ON public.lead_webhooks (org_id);
CREATE INDEX IF NOT EXISTS idx_lead_webhooks_client ON public.lead_webhooks (client_id);

CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  webhook_id        UUID REFERENCES public.lead_webhooks(id) ON DELETE SET NULL,
  name              TEXT,
  phone             TEXT,
  email             TEXT,
  source            TEXT,
  campaign          TEXT,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  rendered_message  TEXT,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_org_unread ON public.leads (org_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_client ON public.leads (client_id);
CREATE INDEX IF NOT EXISTS idx_leads_webhook ON public.leads (webhook_id);

-- ------------------------------------------------------------
-- 7. Triggers
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER trg_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.reports_touch_updated_at();

DROP TRIGGER IF EXISTS trg_reports_updated_at ON public.reports;
CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_touch_updated_at();

DROP TRIGGER IF EXISTS trg_reports_same_org ON public.reports;
CREATE TRIGGER trg_reports_same_org
  BEFORE INSERT OR UPDATE OF org_id, client_id ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_assert_same_org();

DROP TRIGGER IF EXISTS trg_report_parts_same_org ON public.report_parts;
CREATE TRIGGER trg_report_parts_same_org
  BEFORE INSERT OR UPDATE OF report_id, ad_account_id ON public.report_parts
  FOR EACH ROW EXECUTE FUNCTION public.reports_assert_same_org();

DROP TRIGGER IF EXISTS trg_notification_rules_same_org ON public.notification_rules;
CREATE TRIGGER trg_notification_rules_same_org
  BEFORE INSERT OR UPDATE OF org_id, client_id, ad_account_id ON public.notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.reports_assert_same_org();

DROP TRIGGER IF EXISTS trg_lead_webhooks_same_org ON public.lead_webhooks;
CREATE TRIGGER trg_lead_webhooks_same_org
  BEFORE INSERT OR UPDATE OF org_id, client_id ON public.lead_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.reports_assert_same_org();

DROP TRIGGER IF EXISTS trg_leads_same_org ON public.leads;
CREATE TRIGGER trg_leads_same_org
  BEFORE INSERT OR UPDATE OF org_id, client_id, webhook_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.reports_assert_same_org();

-- ------------------------------------------------------------
-- 8. RLS
-- ------------------------------------------------------------

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_parts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_webhooks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads             ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.message_templates, public.reports, public.report_parts,
              public.report_runs, public.lead_webhooks, public.leads FROM anon;

-- Tabelas com org_id NOT NULL: CRUD restrito à própria org.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['reports', 'lead_webhooks', 'leads'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (org_id = (SELECT public.auth_org_id()))',
      t || '_select_org', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (org_id = (SELECT public.auth_org_id()))',
      t || '_insert_org', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (org_id = (SELECT public.auth_org_id())) WITH CHECK (org_id = (SELECT public.auth_org_id()))',
      t || '_update_org', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_org', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (org_id = (SELECT public.auth_org_id()))',
      t || '_delete_org', t);
  END LOOP;
END $$;

-- report_runs: só leitura para o usuário (idempotência do cron não pode ser forjada).
DROP POLICY IF EXISTS report_runs_insert_org ON public.report_runs;
DROP POLICY IF EXISTS report_runs_update_org ON public.report_runs;
DROP POLICY IF EXISTS report_runs_delete_org ON public.report_runs;
DROP POLICY IF EXISTS report_runs_select_org ON public.report_runs;
CREATE POLICY report_runs_select_org ON public.report_runs
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

-- message_templates: lê os do sistema (org_id NULL) e os da org; escreve só os da org.
DROP POLICY IF EXISTS message_templates_select_org ON public.message_templates;
CREATE POLICY message_templates_select_org ON public.message_templates
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS message_templates_insert_org ON public.message_templates;
CREATE POLICY message_templates_insert_org ON public.message_templates
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS message_templates_update_org ON public.message_templates;
CREATE POLICY message_templates_update_org ON public.message_templates
  FOR UPDATE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS message_templates_delete_org ON public.message_templates;
CREATE POLICY message_templates_delete_org ON public.message_templates
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

-- report_parts: herda a org do relatório pai.
DROP POLICY IF EXISTS report_parts_select_org ON public.report_parts;
CREATE POLICY report_parts_select_org ON public.report_parts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_parts.report_id AND r.org_id = (SELECT public.auth_org_id())
  ));

DROP POLICY IF EXISTS report_parts_insert_org ON public.report_parts;
CREATE POLICY report_parts_insert_org ON public.report_parts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_parts.report_id AND r.org_id = (SELECT public.auth_org_id())
  ));

DROP POLICY IF EXISTS report_parts_update_org ON public.report_parts;
CREATE POLICY report_parts_update_org ON public.report_parts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_parts.report_id AND r.org_id = (SELECT public.auth_org_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_parts.report_id AND r.org_id = (SELECT public.auth_org_id())
  ));

DROP POLICY IF EXISTS report_parts_delete_org ON public.report_parts;
CREATE POLICY report_parts_delete_org ON public.report_parts
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_parts.report_id AND r.org_id = (SELECT public.auth_org_id())
  ));
