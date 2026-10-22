-- Métricas extras do Google Ads por campanha e dia: interações, todas as conversões, parcelas de
-- impressão (Pesquisa/Display), posição no topo e vídeo. Frações de 0 a 1 como a API devolve;
-- nulas quando a campanha não tem a métrica (ex.: parcela de Pesquisa numa campanha de vídeo).
-- Preenchidas por uma consulta separada do sync, que nunca derruba as métricas principais.

ALTER TABLE public.google_ads_daily_metrics
  ADD COLUMN IF NOT EXISTS interactions bigint NOT NULL DEFAULT 0 CHECK (interactions >= 0),
  ADD COLUMN IF NOT EXISTS all_conversions numeric(16, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS all_conversions_value numeric(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS search_impression_share numeric(6, 5)
    CHECK (search_impression_share IS NULL OR search_impression_share BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS search_budget_lost_impression_share numeric(6, 5)
    CHECK (search_budget_lost_impression_share IS NULL OR search_budget_lost_impression_share BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS search_rank_lost_impression_share numeric(6, 5)
    CHECK (search_rank_lost_impression_share IS NULL OR search_rank_lost_impression_share BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS content_budget_lost_impression_share numeric(6, 5)
    CHECK (content_budget_lost_impression_share IS NULL OR content_budget_lost_impression_share BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS top_impression_percentage numeric(6, 5)
    CHECK (top_impression_percentage IS NULL OR top_impression_percentage BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS absolute_top_impression_percentage numeric(6, 5)
    CHECK (absolute_top_impression_percentage IS NULL OR absolute_top_impression_percentage BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS video_views bigint NOT NULL DEFAULT 0 CHECK (video_views >= 0),
  ADD COLUMN IF NOT EXISTS video_view_rate numeric(6, 5)
    CHECK (video_view_rate IS NULL OR video_view_rate BETWEEN 0 AND 1);
