-- ============================================================================
-- Migration: 20260315000002_performance_indexes_and_views.sql
-- Purpose: Índices compostos e view materializada para dashboard performance
-- Risk: LOW (apenas otimização de queries)
-- ============================================================================
-- Índices compostos para queries mais comuns
-- ============================================================================

-- 1. Índice para alerts unread (usado no dashboard)
CREATE INDEX IF NOT EXISTS idx_alerts_org_unread
ON alerts(org_id, status)
WHERE status = 'unread';

-- 2. Índice para campaigns por status (usado em filtros)
CREATE INDEX IF NOT EXISTS idx_campaigns_org_status
ON campaigns(org_id, status, ad_account_id);

-- 3. Índice para ad_accounts ativos
CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_active
ON ad_accounts(org_id, status)
WHERE status = 'active';

-- ============================================================================
-- View Materializada para KPIs agregados
-- ============================================================================
-- Esta view pré-calcula os KPIs por org e data, acelerando o dashboard
-- Refresh: deve ser rodado a cada hora via cron ou webhook

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_kpis AS
SELECT
  org_id,
  date,
  SUM(spend) as total_spend,
  SUM(conversions) as total_conversions,
  SUM(revenue_attributed) as total_revenue,
  SUM(revenue_attributed - spend) as gross_profit,
  COUNT(DISTINCT campaign_id) as active_campaigns
FROM daily_metrics
GROUP BY org_id, date
WITH DATA;

-- Índice único para refresh incremental
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_kpis_org_date
ON mv_dashboard_kpis(org_id, date);

-- Comentário para documentar refresh strategy
COMMENT ON MATERIALIZED VIEW mv_dashboard_kpis IS
  'KPIs pré-calculados por org e data. Refresh via: REFRESH MATERIALIZED VIEW mv_dashboard_kpis;';

-- ============================================================================
-- Função helper para refresh incremental
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_dashboard_kpis()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_duration INTERVAL;
BEGIN
  v_start := NOW();

  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpis;

  v_duration := NOW() - v_start;
  RETURN format('Refresh completado em %s', v_duration);
END;
$$;

-- Grant para execução
GRANT EXECUTE ON FUNCTION refresh_dashboard_kpis() TO authenticated;

-- ============================================================================
-- Trigger para refresh automático após insert em daily_metrics
-- (Opcional - pode causar overhead em alto volume)
-- ============================================================================

-- CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_kpis()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   -- Refresh assíncrono seria ideal, mas PostgreSQL não suporta
--   -- Para alta frequência, usar cron job externo
--   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_kpis;
--   RETURN NULL;
-- END;
-- $$;

-- DROP TRIGGER IF EXISTS trg_refresh_kpis ON daily_metrics;
-- CREATE TRIGGER trg_refresh_kpis
-- AFTER INSERT OR UPDATE ON daily_metrics
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION trigger_refresh_dashboard_kpis();
