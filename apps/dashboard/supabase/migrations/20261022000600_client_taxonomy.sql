-- Segmentos e produtos para classificar os clientes da Carteira (nome + cor, por organização).
-- O cliente aponta para um segmento e um produto da MESMA org (FK composta com org_id);
-- apagar o segmento/produto deixa o cliente sem ele, sem apagar o cliente.

CREATE TABLE IF NOT EXISTS public.client_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  color text NOT NULL DEFAULT '#0f766e' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_segments_org_id_id_key UNIQUE (org_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS client_segments_name_key ON public.client_segments (org_id, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.client_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  color text NOT NULL DEFAULT '#0f766e' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_products_org_id_id_key UNIQUE (org_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS client_products_name_key ON public.client_products (org_id, lower(btrim(name)));

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS segment_id uuid,
  ADD COLUMN IF NOT EXISTS product_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_segment_fk') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_segment_fk
      FOREIGN KEY (org_id, segment_id) REFERENCES public.client_segments (org_id, id) ON DELETE SET NULL (segment_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_product_fk') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_product_fk
      FOREIGN KEY (org_id, product_id) REFERENCES public.client_products (org_id, id) ON DELETE SET NULL (product_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_segment ON public.clients (org_id, segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_product ON public.clients (org_id, product_id) WHERE product_id IS NOT NULL;

ALTER TABLE public.client_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_segments_own_org ON public.client_segments;
CREATE POLICY client_segments_own_org ON public.client_segments
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS client_products_own_org ON public.client_products;
CREATE POLICY client_products_own_org ON public.client_products
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

REVOKE ALL ON public.client_segments, public.client_products FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_segments, public.client_products TO authenticated, service_role;
