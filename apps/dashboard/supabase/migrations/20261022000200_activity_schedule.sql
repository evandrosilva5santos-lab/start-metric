-- ============================================================
-- Agenda a sincronização do histórico de alterações da Meta (Central de Histórico)
-- de hora em hora, no minuto 7 (fora de :00/:30 do meta-sync e dos múltiplos de 5 do dispatch).
--
-- A URL e o segredo ficam no Vault, nunca neste arquivo:
--   meta_activities_url → https://<domínio do painel>/api/cron/meta-activities
--   cron_secret         → mesmo valor de CRON_SECRET na Vercel
-- Enquanto os dois não existirem no Vault, o job roda e não chama nada.
-- Re-executável.
-- ============================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'start-metric-meta-activities';

SELECT cron.schedule(
  'start-metric-meta-activities',
  '7 * * * *',
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
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'meta_activities_url') AS url,
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret') AS secret
  ) s
  WHERE s.url IS NOT NULL AND s.secret IS NOT NULL;
  $job$
);
