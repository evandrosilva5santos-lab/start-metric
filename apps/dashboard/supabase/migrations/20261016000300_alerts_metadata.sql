-- ============================================================
-- alerts.metadata: o avaliador grava esta coluna desde antes da
-- triagem, mas ela nunca existiu no banco (os inserts falhavam).
-- Conteúdo: { target_key, period_start, period_end, currency,
--             account_status, missing_variables, ... }
-- Só adiciona coluna nula; re-executável.
-- ============================================================

SET lock_timeout = '5s';

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS metadata JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.alerts'::regclass
      AND conname = 'alerts_metadata_is_object'
  ) THEN
    ALTER TABLE public.alerts
      ADD CONSTRAINT alerts_metadata_is_object
      CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.alerts VALIDATE CONSTRAINT alerts_metadata_is_object;
