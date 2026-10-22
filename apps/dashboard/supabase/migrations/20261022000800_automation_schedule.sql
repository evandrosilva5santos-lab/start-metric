-- ============================================================
-- Agenda a avaliação das regras automáticas de hora em hora,
-- no minuto 37 (fora dos horários dos outros jobs do painel).
--
-- A URL e o segredo ficam no Vault, nunca neste arquivo:
--   automation_url → https://<domínio do painel>/api/cron/automation
--   cron_secret    → mesmo valor de CRON_SECRET na Vercel
-- Enquanto os dois não existirem no Vault, o job roda e não chama nada.
-- Re-executável.
-- ============================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'start-metric-automation';

SELECT cron.schedule(
  'start-metric-automation',
  '37 * * * *',
  $job$
  SELECT net.http_post(
    url := s.url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || s.secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  FROM (
    SELECT
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'automation_url') AS url,
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret') AS secret
  ) s
  WHERE s.url IS NOT NULL AND s.secret IS NOT NULL;
  $job$
);
