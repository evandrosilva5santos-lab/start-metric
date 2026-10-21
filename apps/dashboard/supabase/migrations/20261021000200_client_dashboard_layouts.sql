-- ============================================================
-- client_dashboard_layouts: cards da Visão geral escolhidos por cliente.
-- cards = lista ordenada de slugs do catálogo (src/lib/dashboard/cards).
-- Sem linha, o painel usa o padrão do objetivo das campanhas.
-- RLS por org_id; a sessão "painel" usa service role e filtra org_id na rota.
-- Só cria; re-executável.
-- ============================================================

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.client_dashboard_layouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cards       JSONB NOT NULL
              CHECK (jsonb_typeof(cards) = 'array' AND jsonb_array_length(cards) BETWEEN 1 AND 24),
  updated_by  UUID NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_dashboard_layouts_client_key UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS client_dashboard_layouts_org_idx ON public.client_dashboard_layouts (org_id);

DROP TRIGGER IF EXISTS client_dashboard_layouts_touch ON public.client_dashboard_layouts;
CREATE TRIGGER client_dashboard_layouts_touch
  BEFORE UPDATE ON public.client_dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.reports_touch_updated_at();

DROP TRIGGER IF EXISTS client_dashboard_layouts_same_org ON public.client_dashboard_layouts;
CREATE TRIGGER client_dashboard_layouts_same_org
  BEFORE INSERT OR UPDATE OF org_id, client_id ON public.client_dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.reports_assert_same_org();

ALTER TABLE public.client_dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_dashboard_layouts_select_org ON public.client_dashboard_layouts;
CREATE POLICY client_dashboard_layouts_select_org ON public.client_dashboard_layouts
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS client_dashboard_layouts_insert_org ON public.client_dashboard_layouts;
CREATE POLICY client_dashboard_layouts_insert_org ON public.client_dashboard_layouts
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS client_dashboard_layouts_update_org ON public.client_dashboard_layouts;
CREATE POLICY client_dashboard_layouts_update_org ON public.client_dashboard_layouts
  FOR UPDATE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS client_dashboard_layouts_delete_org ON public.client_dashboard_layouts;
CREATE POLICY client_dashboard_layouts_delete_org ON public.client_dashboard_layouts
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

REVOKE ALL ON public.client_dashboard_layouts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_dashboard_layouts TO authenticated;
