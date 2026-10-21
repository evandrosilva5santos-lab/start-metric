-- ============================================================
-- Agenda a geração de relatórios a cada 5 min pelo pg_cron + pg_net
-- (o plano Hobby da Vercel só aceita cron diário).
--
-- A URL e o segredo ficam no Vault, nunca neste arquivo:
--   reports_dispatch_url  → https://<domínio do painel>/api/cron/reports-dispatch
--   cron_secret           → mesmo valor de CRON_SECRET na Vercel
-- Enquanto os dois não existirem no Vault, o job roda e não chama nada.
-- Re-executável.
-- ============================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'start-control-reports-dispatch';

SELECT cron.schedule(
  'start-control-reports-dispatch',
  '*/5 * * * *',
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
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reports_dispatch_url') AS url,
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret') AS secret
  ) s
  WHERE s.url IS NOT NULL AND s.secret IS NOT NULL;
  $job$
);
