-- ============================================================
-- daily_metrics: conversões por action_type
--
-- Contrato: objeto plano { "<action_type>": <number> }, ex.
-- {"purchase": 3, "lead": 12}. NULL = linha ainda não ressincronizada;
-- {} = sincronizada sem ações no dia.
-- Só adiciona colunas nulas; nada existente muda.
-- ============================================================

SET lock_timeout = '5s';

ALTER TABLE public.daily_metrics
  ADD COLUMN IF NOT EXISTS actions       JSONB,
  ADD COLUMN IF NOT EXISTS action_values JSONB;

COMMENT ON COLUMN public.daily_metrics.actions IS
  'Contagem por action_type da Meta: {"purchase": 3, "lead": 12}. NULL = ainda não sincronizado.';
COMMENT ON COLUMN public.daily_metrics.action_values IS
  'Valor (moeda da conta) por action_type da Meta: {"purchase": 1890.5}. NULL = ainda não sincronizado.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.daily_metrics'::regclass
      AND conname = 'daily_metrics_actions_is_object'
  ) THEN
    ALTER TABLE public.daily_metrics
      ADD CONSTRAINT daily_metrics_actions_is_object
      CHECK (actions IS NULL OR jsonb_typeof(actions) = 'object') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.daily_metrics'::regclass
      AND conname = 'daily_metrics_action_values_is_object'
  ) THEN
    ALTER TABLE public.daily_metrics
      ADD CONSTRAINT daily_metrics_action_values_is_object
      CHECK (action_values IS NULL OR jsonb_typeof(action_values) = 'object') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.daily_metrics VALIDATE CONSTRAINT daily_metrics_actions_is_object;
ALTER TABLE public.daily_metrics VALIDATE CONSTRAINT daily_metrics_action_values_is_object;
