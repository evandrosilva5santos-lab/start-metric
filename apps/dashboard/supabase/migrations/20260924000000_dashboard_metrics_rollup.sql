-- ============================================================
-- Dashboard: soma das métricas no banco
--
-- Antes o painel baixava todas as linhas de daily_metrics do período
-- (campanhas × dias) e somava em JS. Esta função devolve só os totais:
-- uma linha por campanha e uma linha por dia.
--
-- SECURITY INVOKER: a RLS de daily_metrics (org_id = auth_org_id())
-- continua valendo; o filtro por org_id aqui é só para usar o índice.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_daily_metrics_org_date
  ON daily_metrics (org_id, date);

CREATE OR REPLACE FUNCTION public.dashboard_metrics_rollup(
  p_org_id       UUID,
  p_from         DATE,
  p_to           DATE,
  p_campaign_ids UUID[]
)
RETURNS TABLE (
  kind        TEXT,
  key         TEXT,
  spend       NUMERIC,
  revenue     NUMERIC,
  conversions BIGINT,
  impressions BIGINT,
  clicks      BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT dm.campaign_id, dm.date, dm.spend, dm.revenue_attributed,
           dm.conversions, dm.impressions, dm.clicks
    FROM daily_metrics dm
    WHERE dm.org_id = p_org_id
      AND dm.date BETWEEN p_from AND p_to
      AND dm.campaign_id = ANY (p_campaign_ids)
  )
  SELECT 'campaign'::TEXT, campaign_id::TEXT,
         COALESCE(SUM(spend), 0), COALESCE(SUM(revenue_attributed), 0),
         COALESCE(SUM(conversions), 0)::BIGINT, COALESCE(SUM(impressions), 0)::BIGINT,
         COALESCE(SUM(clicks), 0)::BIGINT
  FROM scoped
  GROUP BY campaign_id
  UNION ALL
  SELECT 'day'::TEXT, date::TEXT,
         COALESCE(SUM(spend), 0), COALESCE(SUM(revenue_attributed), 0),
         COALESCE(SUM(conversions), 0)::BIGINT, COALESCE(SUM(impressions), 0)::BIGINT,
         COALESCE(SUM(clicks), 0)::BIGINT
  FROM scoped
  GROUP BY date;
$$;

REVOKE ALL ON FUNCTION public.dashboard_metrics_rollup(UUID, DATE, DATE, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics_rollup(UUID, DATE, DATE, UUID[]) TO authenticated;
