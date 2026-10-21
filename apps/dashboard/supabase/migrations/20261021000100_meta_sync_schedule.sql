-- ============================================================
-- Agenda a sincronização das contas Meta a cada 30 min pelo pg_cron + pg_net
-- (o plano Hobby da Vercel só aceita cron diário). Cada chamada sincroniza
-- um lote das contas mais desatualizadas; o cron diário da Vercel fica de reserva.
--
-- A URL e o segredo ficam no Vault, nunca neste arquivo:
--   meta_sync_url  → https://<domínio do painel>/api/cron/meta-sync
--   cron_secret    → mesmo valor de CRON_SECRET na Vercel (já usado pelos relatórios)
-- Enquanto os dois não existirem no Vault, o job roda e não chama nada.
-- Re-executável.
-- ============================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'start-metric-meta-sync';

SELECT cron.schedule(
  'start-metric-meta-sync',
  '*/30 * * * *',
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
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'meta_sync_url') AS url,
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret') AS secret
  ) s
  WHERE s.url IS NOT NULL AND s.secret IS NOT NULL;
  $job$
);
