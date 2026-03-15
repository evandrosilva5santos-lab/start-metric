-- Data layer hardening: sales RLS integrity + realtime publication

-- -----------------------------------------------------------------------------
-- 1) SALES TABLE INTEGRITY (typed/defaults/checks)
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.sales_orders
  ALTER COLUMN source TYPE TEXT USING source::text,
  ALTER COLUMN currency TYPE TEXT USING currency::text,
  ALTER COLUMN currency SET DEFAULT 'BRL';

ALTER TABLE IF EXISTS public.sales_orders
  DROP CONSTRAINT IF EXISTS sales_orders_source_check,
  DROP CONSTRAINT IF EXISTS sales_orders_status_check,
  DROP CONSTRAINT IF EXISTS sales_orders_payment_status_check;

ALTER TABLE IF EXISTS public.sales_orders
  ADD CONSTRAINT sales_orders_source_check
    CHECK (source IN ('stripe', 'shopify', 'woocommerce', 'manual')),
  ADD CONSTRAINT sales_orders_status_check
    CHECK (status IN ('draft', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
  ADD CONSTRAINT sales_orders_payment_status_check
    CHECK (payment_status IS NULL OR payment_status IN ('pending', 'paid', 'failed', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id
  ON public.sales_order_items(order_id);

-- -----------------------------------------------------------------------------
-- 2) RLS FIX (remove dependency on non-existent organization_members)
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage their organization orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can view and manage their organization order items" ON public.sales_order_items;

DROP POLICY IF EXISTS sales_orders_select_org ON public.sales_orders;
CREATE POLICY sales_orders_select_org
ON public.sales_orders
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS sales_orders_insert_org ON public.sales_orders;
CREATE POLICY sales_orders_insert_org
ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS sales_orders_update_org ON public.sales_orders;
CREATE POLICY sales_orders_update_org
ON public.sales_orders
FOR UPDATE
TO authenticated
USING (org_id = public.current_org_id())
WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS sales_orders_delete_org ON public.sales_orders;
CREATE POLICY sales_orders_delete_org
ON public.sales_orders
FOR DELETE
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS sales_order_items_select_org ON public.sales_order_items;
CREATE POLICY sales_order_items_select_org
ON public.sales_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales_orders so
    WHERE so.id = sales_order_items.order_id
      AND so.org_id = public.current_org_id()
  )
);

DROP POLICY IF EXISTS sales_order_items_insert_org ON public.sales_order_items;
CREATE POLICY sales_order_items_insert_org
ON public.sales_order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sales_orders so
    WHERE so.id = sales_order_items.order_id
      AND so.org_id = public.current_org_id()
  )
);

DROP POLICY IF EXISTS sales_order_items_update_org ON public.sales_order_items;
CREATE POLICY sales_order_items_update_org
ON public.sales_order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales_orders so
    WHERE so.id = sales_order_items.order_id
      AND so.org_id = public.current_org_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sales_orders so
    WHERE so.id = sales_order_items.order_id
      AND so.org_id = public.current_org_id()
  )
);

DROP POLICY IF EXISTS sales_order_items_delete_org ON public.sales_order_items;
CREATE POLICY sales_order_items_delete_org
ON public.sales_order_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales_orders so
    WHERE so.id = sales_order_items.order_id
      AND so.org_id = public.current_org_id()
  )
);

-- -----------------------------------------------------------------------------
-- 3) REALTIME PUBLICATION (idempotent)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  target_table TEXT;
  target_tables TEXT[] := ARRAY[
    'alerts',
    'notification_rules',
    'daily_metrics',
    'tracking_events',
    'sales_orders',
    'sales_order_items'
  ];
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    FOREACH target_table IN ARRAY target_tables
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = target_table
          AND c.relkind = 'r'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = target_table
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          target_table
        );
      END IF;
    END LOOP;
  END IF;
END;
$$;
