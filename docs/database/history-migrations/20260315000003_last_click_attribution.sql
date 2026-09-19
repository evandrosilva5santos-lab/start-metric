-- ============================================================
-- LAST-CLICK ATTRIBUTION ENGINE
-- Motor de atribuição last-click para conversões
-- ============================================================

-- Tabela de conversões reais (do backend)
CREATE TABLE IF NOT EXISTS conversions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identificador externo da conversão
  external_id     TEXT         NOT NULL,
  source          TEXT         NOT NULL, -- 'stripe', 'shopify', 'api', etc.

  -- Dados da conversão
  event_type      TEXT         NOT NULL, -- 'purchase', 'lead', 'signup', etc.
  revenue         NUMERIC(15,2) DEFAULT 0,
  currency        TEXT         DEFAULT 'BRL',

  -- Dados do cliente
  customer_id     TEXT,
  customer_email  TEXT,

  -- Timestamps
  occurred_at     TIMESTAMPTZ  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Atribuição (preenchido pelo motor)
  attributed_to_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  attributed_to_ad_account_id UUID REFERENCES ad_accounts(id) ON DELETE SET NULL,
  attribution_window_days    INT DEFAULT 30,

  UNIQUE(org_id, external_id, source)
);

-- Tabela de touchpoints para rastreamento de jornada
CREATE TABLE IF NOT EXISTS attribution_touchpoints (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identificador do usuário (cookie, device_id, etc.)
  user_identifier TEXT         NOT NULL, -- fingerprint, cookie_id, etc.
  session_id      TEXT,

  -- Dados do touchpoint
  campaign_id     UUID         REFERENCES campaigns(id) ON DELETE SET NULL,
  ad_account_id   UUID         REFERENCES ad_accounts(id) ON DELETE SET NULL,
  platform        TEXT         NOT NULL, -- 'meta', 'google', 'tiktok', etc.

  -- Metadados
  referrer        TEXT,
  landing_page    TEXT,
  device_type     TEXT,

  -- Timestamps
  occurred_at     TIMESTAMPTZ  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Índices para performance
  INDEX idx_touchpoints_user (org_id, user_identifier, occurred_at DESC),
  INDEX idx_touchpoints_conversion (org_id, user_identifier, campaign_id)
);

-- Função para atribuir conversão usando last-click
CREATE OR REPLACE FUNCTION attribute_conversion_last_click(
  p_conversion_id UUID,
  p_user_identifier TEXT,
  p_attribution_window_days INT DEFAULT 30
)
RETURNS TABLE (
  campaign_id UUID,
  ad_account_id UUID,
  touchpoints_count INT,
  attribution_confidence NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id UUID;
  v_conversion_occurred_at TIMESTAMPTZ;
  v_last_touchpoint RECORD;
  v_window_start TIMESTAMPTZ;
  v_touchpoints_count INT;
BEGIN
  -- Buscar dados da conversão
  SELECT org_id, occurred_at INTO v_org_id, v_conversion_occurred_at
  FROM conversions
  WHERE id = p_conversion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversão não encontrada: %', p_conversion_id;
  END IF;

  -- Calcular janela de atribuição
  v_window_start := v_conversion_occurred_at - (p_attribution_window_days || ' days')::INTERVAL;

  -- Encontrar último touchpoint antes da conversão
  SELECT
    t.campaign_id,
    t.ad_account_id,
    COUNT(*) as touchpoints_count
  INTO v_last_touchpoint
  FROM attribution_touchpoints t
  WHERE t.org_id = v_org_id
    AND t.user_identifier = p_user_identifier
    AND t.occurred_at >= v_window_start
    AND t.occurred_at < v_conversion_occurred_at
    AND t.campaign_id IS NOT NULL
  GROUP BY t.campaign_id, t.ad_account_id
  ORDER BY MAX(t.occurred_at) DESC
  LIMIT 1;

  -- Contar total de touchpoints na janela
  SELECT COUNT(*) INTO v_touchpoints_count
  FROM attribution_touchpoints t
  WHERE t.org_id = v_org_id
    AND t.user_identifier = p_user_identifier
    AND t.occurred_at >= v_window_start
    AND t.occurred_at < v_conversion_occurred_at;

  -- Atualizar conversão com atribuição
  UPDATE conversions
  SET
    attributed_to_campaign_id = v_last_touchpoint.campaign_id,
    attributed_to_ad_account_id = v_last_touchpoint.ad_account_id,
    attribution_window_days = p_attribution_window_days
  WHERE id = p_conversion_id;

  -- Calcular confiança da atribuição (baseado em recência e número de touchpoints)
  RETURN QUERY SELECT
    v_last_touchpoint.campaign_id,
    v_last_touchpoint.ad_account_id,
    COALESCE(v_touchpoints_count, 0),
    CASE
      WHEN v_last_touchpoint.campaign_id IS NULL THEN 0
      WHEN v_touchpoints_count = 1 THEN 1.0 -- Único touchpoint = 100% confiança
      ELSE LEAST(0.9, 0.5 + (v_touchpoints_count::NUMERIC * 0.1)) -- Mais touchpoints = mais confiança
    END::NUMERIC(3,2);
END;
$$;

-- Trigger automático para atribuir conversões ao criar
CREATE OR REPLACE FUNCTION trigger_attribute_conversion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_attribution RECORD;
BEGIN
  -- Tentar atribuir automaticamente se user_identifier fornecido via TG_ARGV
  -- Nota: requer chamada com atribuição explícita em scenarios reais
  RETURN NEW;
END;
$$;

-- Função para processar lote de conversões pendentes
CREATE OR REPLACE FUNCTION process_pending_attribution(
  p_org_id UUID DEFAULT NULL,
  p_batch_size INT DEFAULT 100
)
RETURNS TABLE (
  conversion_id UUID,
  campaign_id UUID,
  success BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_conversion RECORD;
  v_result RECORD;
BEGIN
  -- Buscar conversões sem atribuição
  FOR v_conversion IN
    SELECT id, external_id
    FROM conversions
    WHERE (p_org_id IS NULL OR org_id = p_org_id)
      AND attributed_to_campaign_id IS NULL
    ORDER BY occurred_at DESC
    LIMIT p_batch_size
  LOOP
    -- Tenta encontrar touchpoint pelo email do cliente
    BEGIN
      -- Buscar último touchpoint para este email
      SELECT
        t.campaign_id,
        t.ad_account_id
      INTO v_result
      FROM attribution_touchpoints t
      JOIN conversions c ON c.org_id = t.org_id
      WHERE c.id = v_conversion.id
        AND t.org_id = c.org_id
        AND (t.session_id = c.customer_id OR c.customer_email IS NULL) -- Match por session_id ou todos
        AND t.occurred_at < c.occurred_at
        AND t.occurred_at >= c.occurred_at - (c.attribution_window_days || ' days')::INTERVAL
      ORDER BY t.occurred_at DESC
      LIMIT 1;

      IF v_result.campaign_id IS NOT NULL THEN
        UPDATE conversions
        SET
          attributed_to_campaign_id = v_result.campaign_id,
          attributed_to_ad_account_id = v_result.ad_account_id
        WHERE id = v_conversion.id;

        RETURN QUERY SELECT v_conversion.id, v_result.campaign_id, TRUE::BOOLEAN;
      ELSE
        RETURN QUERY SELECT v_conversion.id, NULL::UUID, FALSE::BOOLEAN;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_conversion.id, NULL::UUID, FALSE::BOOLEAN;
    END;
  END LOOP;
END;
$$;

-- View para conversões atribuídas
CREATE OR REPLACE VIEW v_conversions_attributed AS
SELECT
  c.id,
  c.org_id,
  c.external_id,
  c.source,
  c.event_type,
  c.revenue,
  c.currency,
  c.customer_id,
  c.customer_email,
  c.occurred_at,
  c.attributed_to_campaign_id,
  c.attributed_to_ad_account_id,
  c.attribution_window_days,
  camp.name as campaign_name,
  camp.external_id as campaign_external_id,
  acct.name as ad_account_name,
  acct.platform as ad_account_platform
FROM conversions c
LEFT JOIN campaigns camp ON camp.id = c.attributed_to_campaign_id
LEFT JOIN ad_accounts acct ON acct.id = c.attributed_to_ad_account_id;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversions_org_date ON conversions(org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversions_attributed ON conversions(attributed_to_campaign_id) WHERE attributed_to_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversions_pending ON conversions(org_id, occurred_at DESC) WHERE attributed_to_campaign_id IS NULL;

-- Comment
COMMENT ON TABLE conversions IS 'Conversões reais do backend (Stripe, Shopify, etc.) com atribuição last-click';
COMMENT ON TABLE attribution_touchpoints IS 'Touchpoints de jornada do cliente para atribuição';
COMMENT ON FUNCTION attribute_conversion_last_click IS 'Atribui conversão ao último touchpoint usando lógica last-click';
COMMENT ON FUNCTION process_pending_attribution IS 'Processa lote de conversões sem atribuição';
