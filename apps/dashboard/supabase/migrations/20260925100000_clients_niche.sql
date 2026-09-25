-- ============================================================
-- Clientes: nicho e cadastro das contas por cliente
--
-- O seletor do topo passa a ser cliente → contas. Cada conta pertence a
-- no máximo um cliente (ad_accounts.client_id, já existente).
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS niche TEXT;

COMMENT ON COLUMN public.clients.niche IS 'Nicho/segmento do cliente (ex.: imobiliário, estética).';

CREATE INDEX IF NOT EXISTS idx_ad_accounts_org_client
  ON public.ad_accounts (org_id, client_id);
