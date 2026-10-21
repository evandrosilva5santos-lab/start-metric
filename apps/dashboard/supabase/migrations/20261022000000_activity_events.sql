-- Central de Histórico: eventos, payload bruto, revisões e vínculos conta → cliente no tempo.
-- Desenho e decisões: docs/PLANO_HISTORICO_PRESTACAO_CONTAS.md (D14, D23–D28, D35, D38).
-- Escrita só por funções SECURITY DEFINER com org explícita (o painel usa service role).
-- Imutabilidade por gatilho: só colunas de uma lista fechada mudam, e cada uma só pela função dona dela.
-- Limite honesto: o dono do banco pode desligar gatilhos; isto protege contra escrita acidental do app.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- Chaves compostas para FKs que impedem misturar orgs (tabelas pequenas, lock breve).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_org_id_id_key') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_org_id_id_key UNIQUE (org_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ad_accounts_org_id_id_key') THEN
    ALTER TABLE public.ad_accounts ADD CONSTRAINT ad_accounts_org_id_id_key UNIQUE (org_id, id);
  END IF;
END $$;

-- ── Contexto das funções (quem está alterando e por quê) ────────────────────
CREATE OR REPLACE FUNCTION public.activity_ctx(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$ SELECT nullif(current_setting('app.activity_' || p_key, true), '') $$;

CREATE OR REPLACE FUNCTION public.activity_set_ctx(p_rpc text, p_actor uuid, p_reason text)
RETURNS void
LANGUAGE sql
SET search_path = pg_catalog, public
AS $$
  SELECT set_config('app.activity_rpc', coalesce(p_rpc, ''), true),
         set_config('app.activity_actor', coalesce(p_actor::text, ''), true),
         set_config('app.activity_reason', coalesce(p_reason, ''), true);
$$;

-- ── Vínculos conta → cliente ao longo do tempo ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_account_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  client_id uuid NOT NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  presumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_valid_range CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT assignments_account_fk FOREIGN KEY (org_id, ad_account_id)
    REFERENCES public.ad_accounts (org_id, id) ON DELETE CASCADE,
  CONSTRAINT assignments_client_fk FOREIGN KEY (org_id, client_id)
    REFERENCES public.clients (org_id, id) ON DELETE CASCADE,
  CONSTRAINT assignments_no_overlap EXCLUDE USING gist (
    ad_account_id WITH =,
    tstzrange(coalesce(valid_from, '-infinity'::timestamptz), coalesce(valid_to, 'infinity'::timestamptz)) WITH &&
  )
);
CREATE INDEX IF NOT EXISTS idx_assignments_account_from ON public.ad_account_client_assignments (ad_account_id, valid_from);
CREATE INDEX IF NOT EXISTS idx_assignments_client ON public.ad_account_client_assignments (org_id, client_id);

-- Vínculos atuais entram como "desde sempre, presumido": o passado é atribuído com selo de presunção.
INSERT INTO public.ad_account_client_assignments (org_id, ad_account_id, client_id, valid_from, presumed)
SELECT a.org_id, a.id, a.client_id, NULL, true
FROM public.ad_accounts a
WHERE a.client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.ad_account_client_assignments x WHERE x.ad_account_id = a.id);

-- ── Eventos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  client_id uuid,
  attribution text NOT NULL DEFAULT 'none'
    CHECK (attribution IN ('by_assignment', 'assumed', 'manual_override', 'none')),
  ad_account_id uuid,
  account_external_id text CHECK (char_length(account_external_id) <= 64),
  source text NOT NULL CHECK (source IN ('meta', 'system', 'manual', 'detected')),
  source_app text CHECK (char_length(source_app) <= 200),
  event_type text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 120),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN (
    'budget', 'status', 'creative', 'targeting', 'structure', 'bidding', 'tracking', 'billing', 'analysis',
    'meeting', 'optimization', 'task', 'note', 'connection', 'report', 'platform', 'other')),
  counts_as_work boolean NOT NULL DEFAULT false,
  classifier_version integer NOT NULL DEFAULT 1 CHECK (classifier_version > 0),
  object_level text NOT NULL CHECK (object_level IN (
    'account', 'campaign', 'ad_set', 'ad', 'audience', 'creative_library', 'tracking', 'client', 'report',
    'integration', 'other')),
  object_external_id text CHECK (char_length(object_external_id) <= 64),
  object_name text CHECK (char_length(object_name) <= 500),
  campaign_external_id text CHECK (char_length(campaign_external_id) <= 64),
  campaign_name text CHECK (char_length(campaign_name) <= 500),
  ad_set_external_id text CHECK (char_length(ad_set_external_id) <= 64),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  description text CHECK (char_length(description) <= 4000),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor_kind text NOT NULL CHECK (actor_kind IN ('person', 'platform', 'integration', 'system_user', 'unknown')),
  actor_name text CHECK (char_length(actor_name) <= 200),
  actor_external_id text CHECK (char_length(actor_external_id) <= 64),
  actor_user_id uuid,
  status text NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'failed', 'unknown')),
  error_message text CHECK (char_length(error_message) <= 500),
  "before" jsonb CHECK ("before" IS NULL OR jsonb_typeof("before") IN ('object', 'array')),
  "after" jsonb CHECK ("after" IS NULL OR jsonb_typeof("after") IN ('object', 'array')),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'client')),
  dedupe_key text NOT NULL CHECK (char_length(dedupe_key) BETWEEN 1 AND 512),
  reconciled_with uuid,
  annotates_id uuid,
  supersedes_id uuid,
  evidence_url text CHECK (evidence_url ~ '^https?://' AND char_length(evidence_url) <= 2000),
  created_by uuid,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text CHECK (char_length(void_reason) <= 500),
  CONSTRAINT activity_events_org_dedupe_key UNIQUE (org_id, dedupe_key),
  CONSTRAINT activity_events_org_id_id_key UNIQUE (org_id, id),
  CONSTRAINT activity_events_client_fk FOREIGN KEY (org_id, client_id)
    REFERENCES public.clients (org_id, id) ON DELETE RESTRICT,
  -- Excluir a conta não apaga o histórico: só solta o vínculo (o act_… fica em account_external_id).
  CONSTRAINT activity_events_account_fk FOREIGN KEY (org_id, ad_account_id)
    REFERENCES public.ad_accounts (org_id, id) ON DELETE SET NULL (ad_account_id),
  CONSTRAINT activity_events_reconciled_fk FOREIGN KEY (org_id, reconciled_with)
    REFERENCES public.activity_events (org_id, id) ON DELETE RESTRICT,
  CONSTRAINT activity_events_annotates_fk FOREIGN KEY (org_id, annotates_id)
    REFERENCES public.activity_events (org_id, id) ON DELETE RESTRICT,
  CONSTRAINT activity_events_supersedes_fk FOREIGN KEY (org_id, supersedes_id)
    REFERENCES public.activity_events (org_id, id) ON DELETE RESTRICT,
  CONSTRAINT activity_events_not_self CHECK (reconciled_with <> id AND annotates_id <> id AND supersedes_id <> id),
  CONSTRAINT activity_events_void_consistent CHECK (
    (voided_at IS NULL) = (voided_by IS NULL)
    AND (voided_at IS NULL OR char_length(btrim(void_reason)) >= 3)
  ),
  CONSTRAINT meta_requires_account CHECK (source <> 'meta' OR account_external_id IS NOT NULL),
  CONSTRAINT manual_requires_author CHECK (source <> 'manual' OR created_by IS NOT NULL),
  CONSTRAINT attribution_matches_client CHECK ((attribution = 'none') = (client_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_activity_client_time ON public.activity_events (org_id, client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_client_work ON public.activity_events (org_id, client_id, occurred_at DESC)
  WHERE voided_at IS NULL AND counts_as_work;
CREATE INDEX IF NOT EXISTS idx_activity_account_time ON public.activity_events (org_id, ad_account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_client_campaign ON public.activity_events (org_id, client_id, campaign_external_id, occurred_at DESC)
  WHERE campaign_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_reconciled ON public.activity_events (reconciled_with) WHERE reconciled_with IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_annotates ON public.activity_events (annotates_id) WHERE annotates_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_supersedes ON public.activity_events (supersedes_id) WHERE supersedes_id IS NOT NULL;

-- Payload original da Meta, separado da tabela quente; só o servidor lê; só a retenção apaga.
CREATE TABLE IF NOT EXISTS public.activity_event_raw (
  event_id uuid PRIMARY KEY,
  org_id uuid NOT NULL,
  raw jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_raw_event_fk FOREIGN KEY (org_id, event_id)
    REFERENCES public.activity_events (org_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_activity_raw_created ON public.activity_event_raw (created_at);

-- Toda mudança em colunas mutáveis fica registrada aqui.
CREATE TABLE IF NOT EXISTS public.activity_event_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id uuid NOT NULL,
  event_id uuid NOT NULL,
  column_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  rpc text NOT NULL,
  changed_by uuid,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_revisions_event_fk FOREIGN KEY (org_id, event_id)
    REFERENCES public.activity_events (org_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_activity_revisions_event ON public.activity_event_revisions (event_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_revisions_org ON public.activity_event_revisions (org_id, changed_at DESC);

-- ── Gatilhos de imutabilidade (DEFINER: valem igual para service role e para o painel) ──
CREATE OR REPLACE FUNCTION public.activity_events_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rpc text := public.activity_ctx('rpc');
  v_changed text[];
  v_allowed text[];
  v_blocked text[];
BEGIN
  SELECT coalesce(array_agg(n.key ORDER BY n.key), ARRAY[]::text[])
  INTO v_changed
  FROM jsonb_each(to_jsonb(NEW)) AS n
  WHERE n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);
  IF cardinality(v_changed) = 0 THEN
    RETURN NEW;
  END IF;

  v_allowed := CASE v_rpc
    WHEN 'void' THEN ARRAY['voided_at', 'voided_by', 'void_reason']
    WHEN 'reassign' THEN ARRAY['client_id', 'attribution']
    WHEN 'assignment' THEN ARRAY['client_id', 'attribution']
    WHEN 'reclassify' THEN ARRAY['category', 'counts_as_work', 'classifier_version']
    WHEN 'visibility' THEN ARRAY['visibility']
    WHEN 'manual_edit' THEN ARRAY['title', 'description', 'occurred_at', 'evidence_url', 'campaign_external_id', 'campaign_name', 'visibility']
    ELSE ARRAY[]::text[]
  END;

  -- Sempre permitido: nome da campanha de vazio para preenchido (resolvido depois da importação).
  IF OLD.campaign_name IS NULL AND btrim(coalesce(NEW.campaign_name, '')) <> '' THEN
    v_allowed := array_append(v_allowed, 'campaign_name');
  END IF;
  -- Sempre permitido: soltar a conta quando ela foi excluída (FK ON DELETE SET NULL).
  IF NEW.ad_account_id IS NULL AND OLD.ad_account_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.ad_accounts WHERE id = OLD.ad_account_id) THEN
    v_allowed := array_append(v_allowed, 'ad_account_id');
  END IF;

  SELECT coalesce(array_agg(c), ARRAY[]::text[]) INTO v_blocked FROM unnest(v_changed) AS c WHERE NOT (c = ANY(v_allowed));
  IF cardinality(v_blocked) > 0 THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_IMMUTABLE: %', array_to_string(v_blocked, ',') USING ERRCODE = '42501';
  END IF;
  IF v_rpc = 'void' AND OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_IMMUTABLE: already voided' USING ERRCODE = '42501';
  END IF;
  IF v_rpc = 'manual_edit' AND (OLD.source <> 'manual' OR now() - OLD.recorded_at > interval '15 minutes') THEN
    RAISE EXCEPTION 'ACTIVITY_EVENT_IMMUTABLE: manual edit window' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_events_record_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.activity_event_revisions (org_id, event_id, column_name, old_value, new_value, rpc, changed_by, reason)
  SELECT NEW.org_id, NEW.id, n.key, to_jsonb(OLD) -> n.key, n.value,
         coalesce(public.activity_ctx('rpc'), 'direct'),
         public.activity_ctx('actor')::uuid,
         public.activity_ctx('reason')
  FROM jsonb_each(to_jsonb(NEW)) AS n
  WHERE n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_block_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'activity_event_raw' AND TG_OP = 'DELETE' AND public.activity_ctx('rpc') = 'retention' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '%: % não é permitido', CASE TG_TABLE_NAME
      WHEN 'activity_events' THEN 'ACTIVITY_EVENT_IMMUTABLE'
      WHEN 'activity_event_raw' THEN 'ACTIVITY_RAW_IMMUTABLE'
      ELSE 'ACTIVITY_REVISION_IMMUTABLE' END, TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS activity_events_guard_update ON public.activity_events;
CREATE TRIGGER activity_events_guard_update BEFORE UPDATE ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.activity_events_guard_update();
DROP TRIGGER IF EXISTS activity_events_record_revision ON public.activity_events;
CREATE TRIGGER activity_events_record_revision AFTER UPDATE ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.activity_events_record_revision();
DROP TRIGGER IF EXISTS activity_events_block_delete ON public.activity_events;
CREATE TRIGGER activity_events_block_delete BEFORE DELETE ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION public.activity_block_change();
DROP TRIGGER IF EXISTS activity_events_block_truncate ON public.activity_events;
CREATE TRIGGER activity_events_block_truncate BEFORE TRUNCATE ON public.activity_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.activity_block_change();

DROP TRIGGER IF EXISTS activity_raw_block_update ON public.activity_event_raw;
CREATE TRIGGER activity_raw_block_update BEFORE UPDATE OR DELETE ON public.activity_event_raw
  FOR EACH ROW EXECUTE FUNCTION public.activity_block_change();
DROP TRIGGER IF EXISTS activity_raw_block_truncate ON public.activity_event_raw;
CREATE TRIGGER activity_raw_block_truncate BEFORE TRUNCATE ON public.activity_event_raw
  FOR EACH STATEMENT EXECUTE FUNCTION public.activity_block_change();

DROP TRIGGER IF EXISTS activity_revisions_block_change ON public.activity_event_revisions;
CREATE TRIGGER activity_revisions_block_change BEFORE UPDATE OR DELETE ON public.activity_event_revisions
  FOR EACH ROW EXECUTE FUNCTION public.activity_block_change();
DROP TRIGGER IF EXISTS activity_revisions_block_truncate ON public.activity_event_revisions;
CREATE TRIGGER activity_revisions_block_truncate BEFORE TRUNCATE ON public.activity_event_revisions
  FOR EACH STATEMENT EXECUTE FUNCTION public.activity_block_change();

-- ── Cliente de uma conta num instante ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activity_client_for(p_ad_account_id uuid, p_at timestamptz)
RETURNS TABLE(client_id uuid, attribution text)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  WITH covering AS (
    SELECT a.client_id,
           CASE WHEN a.presumed THEN 'assumed' ELSE 'by_assignment' END AS attribution,
           0 AS rank
    FROM public.ad_account_client_assignments a
    WHERE a.ad_account_id = p_ad_account_id
      AND coalesce(a.valid_from, '-infinity'::timestamptz) <= p_at
      AND p_at < coalesce(a.valid_to, 'infinity'::timestamptz)
  ),
  first_after AS (
    -- Antes do primeiro vínculo conhecido: presume o primeiro cliente que recebeu a conta.
    SELECT a.client_id, 'assumed' AS attribution, 1 AS rank
    FROM public.ad_account_client_assignments a
    WHERE a.ad_account_id = p_ad_account_id
      AND a.valid_from > p_at
      AND NOT EXISTS (
        SELECT 1 FROM public.ad_account_client_assignments b
        WHERE b.ad_account_id = p_ad_account_id
          AND coalesce(b.valid_from, '-infinity'::timestamptz) <= p_at
      )
    ORDER BY a.valid_from
    LIMIT 1
  )
  SELECT client_id, attribution FROM (SELECT * FROM covering UNION ALL SELECT * FROM first_after) AS x
  ORDER BY rank
  LIMIT 1;
$$;

-- Mantém o histórico de vínculos e carimba os eventos órfãos quando a conta ganha cliente.
CREATE OR REPLACE FUNCTION public.activity_track_account_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_open public.ad_account_client_assignments%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_open
  FROM public.ad_account_client_assignments
  WHERE ad_account_id = NEW.id AND valid_to IS NULL
  FOR UPDATE;
  IF FOUND THEN
    IF v_open.valid_from = now() THEN
      DELETE FROM public.ad_account_client_assignments WHERE id = v_open.id;
    ELSE
      UPDATE public.ad_account_client_assignments SET valid_to = now() WHERE id = v_open.id;
    END IF;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    INSERT INTO public.ad_account_client_assignments (org_id, ad_account_id, client_id, valid_from, presumed)
    VALUES (NEW.org_id, NEW.id, NEW.client_id, now(), false);

    PERFORM public.activity_set_ctx('assignment', NULL, 'conta ligada ao cliente');
    UPDATE public.activity_events e
    SET client_id = NEW.client_id,
        attribution = CASE WHEN e.occurred_at >= now() THEN 'by_assignment' ELSE 'assumed' END
    WHERE e.org_id = NEW.org_id
      AND e.ad_account_id = NEW.id
      AND e.client_id IS NULL
      AND e.voided_at IS NULL;
    PERFORM public.activity_set_ctx(NULL, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ad_accounts_track_assignment ON public.ad_accounts;
CREATE TRIGGER ad_accounts_track_assignment AFTER INSERT OR UPDATE OF client_id ON public.ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.activity_track_account_assignment();

-- ── Funções de escrita (org sempre explícita) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.insert_activity_events(p_org_id uuid, p_rows jsonb)
RETURNS TABLE(inserted integer, skipped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total integer;
  v_inserted integer;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'ORG_REQUIRED' USING ERRCODE = '22004';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'ROWS_MUST_BE_ARRAY' USING ERRCODE = '22023';
  END IF;
  v_total := jsonb_array_length(p_rows);
  IF v_total > 1000 THEN
    RAISE EXCEPTION 'TOO_MANY_ROWS' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(ad_account_id uuid)
    WHERE r.ad_account_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.ad_accounts a WHERE a.id = r.ad_account_id AND a.org_id = p_org_id)
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_IN_ORG' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(client_id uuid)
    WHERE r.client_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = r.client_id AND c.org_id = p_org_id)
  ) THEN
    RAISE EXCEPTION 'CLIENT_NOT_IN_ORG' USING ERRCODE = '42501';
  END IF;

  WITH src AS (
    SELECT DISTINCT ON (r.dedupe_key) r.*
    FROM jsonb_to_recordset(p_rows) AS r(
      dedupe_key text, source text, source_app text, event_type text, action text, category text,
      counts_as_work boolean, classifier_version integer, object_level text, object_external_id text,
      object_name text, campaign_external_id text, campaign_name text, ad_set_external_id text,
      account_external_id text, ad_account_id uuid, client_id uuid, title text, description text,
      occurred_at timestamptz, actor_kind text, actor_name text, actor_external_id text, actor_user_id uuid,
      status text, error_message text, "before" jsonb, "after" jsonb, visibility text,
      reconciled_with uuid, annotates_id uuid, supersedes_id uuid, evidence_url text, created_by uuid, raw jsonb
    )
    ORDER BY r.dedupe_key
  ),
  resolved AS (
    SELECT s.*,
           coalesce(s.client_id, c.client_id) AS final_client_id,
           CASE WHEN s.client_id IS NOT NULL THEN 'manual_override'
                ELSE coalesce(c.attribution, 'none') END AS final_attribution
    FROM src s
    LEFT JOIN LATERAL public.activity_client_for(s.ad_account_id, s.occurred_at) AS c
      ON s.client_id IS NULL AND s.ad_account_id IS NOT NULL
  ),
  ins AS (
    INSERT INTO public.activity_events (
      org_id, client_id, attribution, ad_account_id, account_external_id, source, source_app, event_type, action,
      category, counts_as_work, classifier_version, object_level, object_external_id, object_name,
      campaign_external_id, campaign_name, ad_set_external_id, title, description, occurred_at, actor_kind,
      actor_name, actor_external_id, actor_user_id, status, error_message, "before", "after", visibility,
      dedupe_key, reconciled_with, annotates_id, supersedes_id, evidence_url, created_by
    )
    SELECT p_org_id, r.final_client_id, r.final_attribution, r.ad_account_id, r.account_external_id, r.source,
           r.source_app, r.event_type, r.action, r.category, coalesce(r.counts_as_work, false),
           coalesce(r.classifier_version, 1), r.object_level, r.object_external_id, r.object_name,
           r.campaign_external_id, r.campaign_name, r.ad_set_external_id, r.title, r.description, r.occurred_at,
           r.actor_kind, r.actor_name, r.actor_external_id, r.actor_user_id, coalesce(r.status, 'succeeded'),
           r.error_message, r."before", r."after", coalesce(r.visibility, 'internal'), r.dedupe_key,
           r.reconciled_with, r.annotates_id, r.supersedes_id, r.evidence_url, r.created_by
    FROM resolved r
    ON CONFLICT (org_id, dedupe_key) DO NOTHING
    RETURNING id, dedupe_key
  ),
  raw_ins AS (
    INSERT INTO public.activity_event_raw (event_id, org_id, raw)
    SELECT i.id, p_org_id, r.raw
    FROM ins i
    JOIN resolved r ON r.dedupe_key = i.dedupe_key
    WHERE r.raw IS NOT NULL
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted FROM ins;

  RETURN QUERY SELECT v_inserted, v_total - v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_assert_events_in_org(p_org_id uuid, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_expected integer := (SELECT count(DISTINCT x) FROM unnest(p_ids) AS x);
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'ORG_REQUIRED' USING ERRCODE = '22004';
  END IF;
  IF p_ids IS NULL OR v_expected = 0 OR v_expected > 1000 THEN
    RAISE EXCEPTION 'INVALID_IDS' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.activity_events WHERE id = ANY(p_ids) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.activity_events WHERE id = ANY(p_ids) AND org_id = p_org_id) <> v_expected THEN
    RAISE EXCEPTION 'EVENT_NOT_IN_ORG' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.activity_assert_reason(p_actor uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'ACTOR_REQUIRED' USING ERRCODE = '22004';
  END IF;
  IF char_length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_activity_events(p_org_id uuid, p_ids uuid[], p_actor uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.activity_assert_reason(p_actor, p_reason);
  PERFORM public.activity_assert_events_in_org(p_org_id, p_ids);
  PERFORM public.activity_set_ctx('void', p_actor, btrim(p_reason));
  UPDATE public.activity_events
  SET voided_at = now(), voided_by = p_actor, void_reason = btrim(p_reason)
  WHERE org_id = p_org_id AND id = ANY(p_ids) AND voided_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.activity_set_ctx(NULL, NULL, NULL);
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reassign_activity_events(
  p_org_id uuid, p_ids uuid[], p_client_id uuid, p_actor uuid, p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public.activity_assert_reason(p_actor, p_reason);
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id AND org_id = p_org_id) THEN
    RAISE EXCEPTION 'CLIENT_NOT_IN_ORG' USING ERRCODE = '42501';
  END IF;
  PERFORM public.activity_assert_events_in_org(p_org_id, p_ids);
  PERFORM public.activity_set_ctx('reassign', p_actor, btrim(p_reason));
  UPDATE public.activity_events
  SET client_id = p_client_id, attribution = 'manual_override'
  WHERE org_id = p_org_id AND id = ANY(p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.activity_set_ctx(NULL, NULL, NULL);
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_activity_visibility(
  p_org_id uuid, p_ids uuid[], p_actor uuid, p_visibility text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'ACTOR_REQUIRED' USING ERRCODE = '22004';
  END IF;
  IF p_visibility NOT IN ('internal', 'client') THEN
    RAISE EXCEPTION 'INVALID_VISIBILITY' USING ERRCODE = '22023';
  END IF;
  PERFORM public.activity_assert_events_in_org(p_org_id, p_ids);
  PERFORM public.activity_set_ctx('visibility', p_actor, NULL);
  UPDATE public.activity_events SET visibility = p_visibility WHERE org_id = p_org_id AND id = ANY(p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.activity_set_ctx(NULL, NULL, NULL);
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reclassify_activity_events(p_org_id uuid, p_rows jsonb, p_version integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_ids uuid[];
  v_count integer;
BEGIN
  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'INVALID_VERSION' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(r.id) INTO v_ids FROM jsonb_to_recordset(p_rows) AS r(id uuid);
  PERFORM public.activity_assert_events_in_org(p_org_id, v_ids);
  PERFORM public.activity_set_ctx('reclassify', NULL, 'classificador v' || p_version);
  UPDATE public.activity_events e
  SET category = r.category, counts_as_work = r.counts_as_work, classifier_version = p_version
  FROM jsonb_to_recordset(p_rows) AS r(id uuid, category text, counts_as_work boolean)
  WHERE e.id = r.id AND e.org_id = p_org_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.activity_set_ctx(NULL, NULL, NULL);
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_manual_activity(p_org_id uuid, p_id uuid, p_actor uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event public.activity_events%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.activity_events WHERE id = p_id AND org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_IN_ORG' USING ERRCODE = '42501';
  END IF;
  IF v_event.source <> 'manual' THEN
    RAISE EXCEPTION 'NOT_MANUAL' USING ERRCODE = '42501';
  END IF;
  IF p_actor IS NULL OR v_event.created_by IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'NOT_AUTHOR' USING ERRCODE = '42501';
  END IF;
  IF now() - v_event.recorded_at > interval '15 minutes' THEN
    RAISE EXCEPTION 'EDIT_WINDOW_CLOSED' USING ERRCODE = '42501';
  END IF;

  PERFORM public.activity_set_ctx('manual_edit', p_actor, 'edição do autor');
  UPDATE public.activity_events
  SET title = CASE WHEN p_patch ? 'title' THEN p_patch ->> 'title' ELSE title END,
      description = CASE WHEN p_patch ? 'description' THEN p_patch ->> 'description' ELSE description END,
      occurred_at = CASE WHEN p_patch ? 'occurred_at' THEN (p_patch ->> 'occurred_at')::timestamptz ELSE occurred_at END,
      evidence_url = CASE WHEN p_patch ? 'evidence_url' THEN p_patch ->> 'evidence_url' ELSE evidence_url END,
      campaign_external_id = CASE WHEN p_patch ? 'campaign_external_id' THEN p_patch ->> 'campaign_external_id' ELSE campaign_external_id END,
      campaign_name = CASE WHEN p_patch ? 'campaign_name' THEN p_patch ->> 'campaign_name' ELSE campaign_name END,
      visibility = CASE WHEN p_patch ? 'visibility' THEN p_patch ->> 'visibility' ELSE visibility END
  WHERE id = p_id AND org_id = p_org_id;
  PERFORM public.activity_set_ctx(NULL, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_activity_raw(p_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_days IS NULL OR p_days < 30 THEN
    RAISE EXCEPTION 'RETENTION_TOO_SHORT' USING ERRCODE = '22023';
  END IF;
  PERFORM public.activity_set_ctx('retention', NULL, 'retenção de ' || p_days || ' dias');
  DELETE FROM public.activity_event_raw WHERE created_at < now() - make_interval(days => p_days);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM public.activity_set_ctx(NULL, NULL, NULL);
  RETURN v_count;
END;
$$;

-- ── Acesso ──────────────────────────────────────────────────────────────────
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_event_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_event_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_account_client_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_events_select_own_org ON public.activity_events;
CREATE POLICY activity_events_select_own_org ON public.activity_events
  FOR SELECT TO authenticated USING (org_id = (SELECT public.auth_org_id()));
DROP POLICY IF EXISTS activity_revisions_select_own_org ON public.activity_event_revisions;
CREATE POLICY activity_revisions_select_own_org ON public.activity_event_revisions
  FOR SELECT TO authenticated USING (org_id = (SELECT public.auth_org_id()));
DROP POLICY IF EXISTS assignments_select_own_org ON public.ad_account_client_assignments;
CREATE POLICY assignments_select_own_org ON public.ad_account_client_assignments
  FOR SELECT TO authenticated USING (org_id = (SELECT public.auth_org_id()));

REVOKE ALL ON public.activity_events, public.activity_event_raw, public.activity_event_revisions,
  public.ad_account_client_assignments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.activity_events, public.activity_event_revisions, public.ad_account_client_assignments
  TO authenticated, service_role;
GRANT SELECT ON public.activity_event_raw TO service_role;
GRANT UPDATE (campaign_name) ON public.activity_events TO service_role;

REVOKE ALL ON FUNCTION
  public.activity_ctx(text),
  public.activity_set_ctx(text, uuid, text),
  public.activity_events_guard_update(),
  public.activity_events_record_revision(),
  public.activity_block_change(),
  public.activity_client_for(uuid, timestamptz),
  public.activity_track_account_assignment(),
  public.insert_activity_events(uuid, jsonb),
  public.activity_assert_events_in_org(uuid, uuid[]),
  public.activity_assert_reason(uuid, text),
  public.void_activity_events(uuid, uuid[], uuid, text),
  public.reassign_activity_events(uuid, uuid[], uuid, uuid, text),
  public.set_activity_visibility(uuid, uuid[], uuid, text),
  public.reclassify_activity_events(uuid, jsonb, integer),
  public.update_manual_activity(uuid, uuid, uuid, jsonb),
  public.purge_activity_raw(integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.insert_activity_events(uuid, jsonb),
  public.void_activity_events(uuid, uuid[], uuid, text),
  public.reassign_activity_events(uuid, uuid[], uuid, uuid, text),
  public.set_activity_visibility(uuid, uuid[], uuid, text),
  public.reclassify_activity_events(uuid, jsonb, integer),
  public.update_manual_activity(uuid, uuid, uuid, jsonb),
  public.purge_activity_raw(integer),
  public.activity_client_for(uuid, timestamptz)
TO service_role;
