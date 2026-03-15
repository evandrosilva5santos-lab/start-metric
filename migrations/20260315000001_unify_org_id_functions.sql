-- ============================================================================
-- Migration: 20260315000001_unify_org_id_functions.sql
-- Purpose: Unificar current_org_id() e auth_org_id() em uma única função
-- Risk: LOW (apenas renomeamento lógico, mesma query)
-- Rollback: Sim (restaurar auth_org_id)
-- ============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. REMOVER a função duplicada (será recriada como alias temporário)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS auth_org_id();

-- -----------------------------------------------------------------------------
-- 2. RECRIAR policies que usavam auth_org_id() para usar current_org_id()
-- -----------------------------------------------------------------------------

-- AD_ACCOUNTS
DROP POLICY IF EXISTS "ad_accounts_select_org" ON ad_accounts;
CREATE POLICY "ad_accounts_select_org"
  ON ad_accounts FOR SELECT
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS "ad_accounts_insert_org" ON ad_accounts;
CREATE POLICY "ad_accounts_insert_org"
  ON ad_accounts FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "ad_accounts_update_org" ON ad_accounts;
CREATE POLICY "ad_accounts_update_org"
  ON ad_accounts FOR UPDATE
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "ad_accounts_delete_org" ON ad_accounts;
CREATE POLICY "ad_accounts_delete_org"
  ON ad_accounts FOR DELETE
  USING (org_id = public.current_org_id());

-- CAMPAIGNS
DROP POLICY IF EXISTS "campaigns_select_org" ON campaigns;
CREATE POLICY "campaigns_select_org"
  ON campaigns FOR SELECT
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS "campaigns_insert_org" ON campaigns;
CREATE POLICY "campaigns_insert_org"
  ON campaigns FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "campaigns_update_org" ON campaigns;
CREATE POLICY "campaigns_update_org"
  ON campaigns FOR UPDATE
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "campaigns_delete_org" ON campaigns;
CREATE POLICY "campaigns_delete_org"
  ON campaigns FOR DELETE
  USING (org_id = public.current_org_id());

-- DAILY_METRICS
DROP POLICY IF EXISTS "daily_metrics_select_org" ON daily_metrics;
CREATE POLICY "daily_metrics_select_org"
  ON daily_metrics FOR SELECT
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS "daily_metrics_insert_org" ON daily_metrics;
CREATE POLICY "daily_metrics_insert_org"
  ON daily_metrics FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "daily_metrics_update_org" ON daily_metrics;
CREATE POLICY "daily_metrics_update_org"
  ON daily_metrics FOR UPDATE
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

-- TRACKING_EVENTS
DROP POLICY IF EXISTS tracking_events_select_org ON tracking_events;
CREATE POLICY tracking_events_select_org
  ON tracking_events FOR SELECT
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS tracking_events_insert_org ON tracking_events;
CREATE POLICY tracking_events_insert_org
  ON tracking_events FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

-- NOTIFICATION_RULES
DROP POLICY IF EXISTS notification_rules_select_org ON notification_rules;
CREATE POLICY notification_rules_select_org
  ON notification_rules FOR SELECT
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS notification_rules_insert_org ON notification_rules;
CREATE POLICY notification_rules_insert_org
  ON notification_rules FOR INSERT
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS notification_rules_update_org ON notification_rules;
CREATE POLICY notification_rules_update_org
  ON notification_rules FOR UPDATE
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS notification_rules_delete_org ON notification_rules;
CREATE POLICY notification_rules_delete_org
  ON notification_rules FOR DELETE
  USING (org_id = public.current_org_id());

-- ALERTS
DROP POLICY IF EXISTS alerts_select_org ON alerts;
CREATE POLICY alerts_select_org
  ON alerts FOR SELECT
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS alerts_update_org ON alerts;
CREATE POLICY alerts_update_org
  ON alerts FOR UPDATE
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

-- -----------------------------------------------------------------------------
-- 3. VALIDAR que current_org_id() está acessível
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_test_id UUID;
BEGIN
    -- Testa se a função pode ser chamada (não vai retornar nada sem usuário, mas valida que existe)
    PERFORM public.current_org_id();

    RAISE NOTICE '✓ current_org_id() está acessível e funcionando';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '✗ Falha ao validar current_org_id(): %', SQLERRM;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT (se algo der errado)
-- =============================================================================
/*
BEGIN;

-- Recriar auth_org_id()
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

-- Reverter policies (substituir current_org_id por auth_org_id)
-- ... (mesmo script acima invertido)

COMMIT;
*/
