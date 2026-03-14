-- Migration: 20260310200000_sales_integration.sql
-- Create sales schema for orders and items

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (source in (stripe, shopify, woocommerce, manual)),
  external_order_id text not null,
  status text not null,
  total_amount numeric(10,2) not null,
  currency text not null default BRL,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_status text,
  tracking_session_id text, -- ID da sessão do tracking client se houver
  utm_source text,
  utm_medium text,
  utm_campaign text,
  attribution_fbc text,
  attribution_fbp text,
  click_id text,
  created_at timestamp with time zone default timezone(utc::text, now()) not null,
  updated_at timestamp with time zone default timezone(utc::text, now()) not null,
  UNIQUE(org_id, external_order_id, source) -- Garantir idempotência de ingestão
);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id text,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  created_at timestamp with time zone default timezone(utc::text, now()) not null
);

-- Indexes para performance nas dashboards
CREATE INDEX IF NOT EXISTS idx_sales_orders_org_id ON public.sales_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON public.sales_orders(created_at);

-- RLS (Row Level Security)
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their organization orders"
  ON public.sales_orders
  FOR ALL
  USING (
    org_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can view and manage their organization order items"
  ON public.sales_order_items
  FOR ALL
  USING (
    order_id IN (
      SELECT id FROM public.sales_orders
      WHERE org_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE profile_id = auth.uid()
      )
    )
  );
