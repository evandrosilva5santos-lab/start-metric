-- Regras automáticas por campanha (Meta e Google): se a métrica do período cruzar o limite,
-- pausar, ativar, subir/baixar o orçamento ou só avisar. Toda regra nasce em modo "simulate"
-- (registra o que faria, sem tocar na conta); "execute" é ligado explicitamente pelo usuário.
-- automation_runs guarda cada decisão (auditoria, carência e limite diário). Escrita das
-- execuções só pelo servidor (service role).

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  client_id uuid,
  ad_account_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  platform text NOT NULL CHECK (platform IN ('meta', 'google')),
  level text NOT NULL DEFAULT 'campaign' CHECK (level IN ('campaign')),
  -- null = todas as campanhas da conta
  entity_external_id text CHECK (entity_external_id ~ '^[0-9]{1,32}$'),
  entity_name text CHECK (char_length(entity_name) <= 500),
  metric text NOT NULL CHECK (metric IN ('cpa', 'roas', 'ctr', 'cpc', 'cpm', 'spend', 'conversions')),
  operator text NOT NULL CHECK (operator IN ('above', 'below')),
  value numeric(14, 4) NOT NULL CHECK (value >= 0),
  period text NOT NULL DEFAULT 'last_3d' CHECK (period IN ('today', 'yesterday', 'last_3d', 'last_7d')),
  min_spend numeric(14, 2) NOT NULL DEFAULT 0 CHECK (min_spend >= 0),
  action text NOT NULL CHECK (action IN ('pause', 'activate', 'decrease_budget', 'increase_budget', 'notify')),
  action_percent integer CHECK (action_percent BETWEEN 1 AND 100),
  mode text NOT NULL DEFAULT 'simulate' CHECK (mode IN ('simulate', 'execute')),
  is_active boolean NOT NULL DEFAULT true,
  cooldown_hours integer NOT NULL DEFAULT 24 CHECK (cooldown_hours BETWEEN 1 AND 720),
  max_actions_per_day integer NOT NULL DEFAULT 3 CHECK (max_actions_per_day BETWEEN 1 AND 50),
  last_evaluated_at timestamptz,
  last_triggered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_rules_org_id_id_key UNIQUE (org_id, id),
  CONSTRAINT automation_rules_budget_needs_percent
    CHECK (action NOT IN ('decrease_budget', 'increase_budget') OR action_percent IS NOT NULL),
  CONSTRAINT automation_rules_account_fk FOREIGN KEY (org_id, ad_account_id)
    REFERENCES public.ad_accounts (org_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON public.automation_rules (org_id, is_active);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  rule_id uuid NOT NULL,
  entity_external_id text NOT NULL CHECK (char_length(entity_external_id) <= 64),
  entity_name text CHECK (char_length(entity_name) <= 500),
  -- null quando o valor é infinito (gastou e não converteu: CPA sem conversão)
  metric_value numeric(18, 4),
  action text NOT NULL CHECK (action IN ('pause', 'activate', 'decrease_budget', 'increase_budget', 'notify')),
  mode text NOT NULL CHECK (mode IN ('simulate', 'execute')),
  status text NOT NULL CHECK (status IN ('simulated', 'executed', 'failed', 'skipped')),
  before_value numeric(14, 2),
  after_value numeric(14, 2),
  detail text CHECK (char_length(detail) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_runs_rule_fk FOREIGN KEY (org_id, rule_id)
    REFERENCES public.automation_rules (org_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON public.automation_runs (rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_org ON public.automation_runs (org_id, created_at DESC);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_rules_own_org ON public.automation_rules;
CREATE POLICY automation_rules_own_org ON public.automation_rules
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS automation_runs_select_own_org ON public.automation_runs;
CREATE POLICY automation_runs_select_own_org ON public.automation_runs
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

REVOKE ALL ON public.automation_rules, public.automation_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated, service_role;
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO service_role;
