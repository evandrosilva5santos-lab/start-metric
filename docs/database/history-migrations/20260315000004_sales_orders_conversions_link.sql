-- ============================================================
-- SALES ORDERS - CONVERSIONS LINK
-- Adiciona colunas para vincular sales_orders com o motor de atribuição
-- ============================================================

-- Adicionar coluna para link com conversions
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS attributed_conversion_id UUID REFERENCES conversions(id) ON DELETE SET NULL;

-- Adicionar colunas específicas do Shopify
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS shop_domain TEXT,
ADD COLUMN IF NOT EXISTS shopify_order_number BIGINT,
ADD COLUMN IF NOT EXISTS shopify_topic TEXT;

-- Adicionar colunas de tracking adicionais
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS landing_page TEXT;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_conversion ON sales_orders(attributed_conversion_id) WHERE attributed_conversion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_orders_shop_domain ON sales_orders(shop_domain) WHERE shop_domain IS NOT NULL;

-- Comment
COMMENT ON COLUMN sales_orders.attributed_conversion_id IS 'Link para a tabela conversions do motor de atribuição last-click';
COMMENT ON COLUMN sales_orders.shop_domain IS 'Domínio da loja Shopify (para multi-tenant)';
COMMENT ON COLUMN sales_orders.shopify_order_number IS 'Número do pedido na Shopify';
COMMENT ON COLUMN sales_orders.shopify_topic IS 'Webhook topic que originou o pedido (orders/create, orders/updated, etc.)';
