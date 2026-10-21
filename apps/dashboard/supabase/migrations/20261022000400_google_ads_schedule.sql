-- ============================================================
-- Agenda a sincronização do Google Ads (campanhas e métricas diárias)
-- a cada 3 horas, no minuto 17 (fora dos horários dos outros jobs do painel).
--
-- A URL e o segredo ficam no Vault, nunca neste arquivo:
--   google_ads_sync_url → https://<domínio do painel>/api/cron/google-ads-sync
--   cron_secret         → mesmo valor de CRON_SECRET na Vercel
-- Enquanto os dois não existirem no Vault, o job roda e não chama nada.
-- Re-executável.
-- ============================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'start-metric-google-ads-sync';

SELECT cron.schedule(
  'start-metric-google-ads-sync',
  '17 */3 * * *',
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
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'google_ads_sync_url') AS url,
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret') AS secret
  ) s
  WHERE s.url IS NOT NULL AND s.secret IS NOT NULL;
  $job$
);
