-- Restaura a RPC de vínculo conta → cliente usada por PUT /api/clients/[id]/accounts.
-- A migration 20261017001000_account_authorization_core.sql nunca foi aplicada; ela também troca a
-- chave única de ad_accounts para (org_id, platform, external_id), o que quebraria os upserts atuais
-- (onConflict "org_id,external_id"). Aqui entra só a função, sem mudar constraints.

CREATE OR REPLACE FUNCTION public.set_client_ad_accounts(
  p_org_id UUID,
  p_client_id UUID,
  p_platform TEXT,
  p_external_ids TEXT[],
  p_confirm_reassignment BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(linked_count INTEGER, unlinked_count INTEGER, reassigned_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_external_ids TEXT[] := COALESCE(p_external_ids, ARRAY[]::TEXT[]);
  v_conflicts TEXT[];
  v_expected INTEGER;
  v_linked INTEGER;
  v_unlinked INTEGER;
  v_reassigned INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND public.auth_org_id() IS DISTINCT FROM p_org_id THEN
    RAISE EXCEPTION 'ORG_SCOPE_MISMATCH' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.clients
  WHERE id = p_client_id
    AND org_id = p_org_id
    AND archived_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLIENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_expected := cardinality(v_external_ids);

  -- Serializa atribuições concorrentes das contas selecionadas.
  PERFORM 1
  FROM public.ad_accounts
  WHERE org_id = p_org_id
    AND platform = p_platform
    AND external_id = ANY(v_external_ids)
  FOR UPDATE;

  IF (
    SELECT count(*)
    FROM public.ad_accounts
    WHERE org_id = p_org_id
      AND platform = p_platform
      AND external_id = ANY(v_external_ids)
  ) <> v_expected THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND_IN_ORG' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(array_agg(external_id ORDER BY external_id), ARRAY[]::TEXT[])
  INTO v_conflicts
  FROM public.ad_accounts
  WHERE org_id = p_org_id
    AND platform = p_platform
    AND external_id = ANY(v_external_ids)
    AND client_id IS NOT NULL
    AND client_id <> p_client_id;

  v_reassigned := cardinality(v_conflicts);
  IF v_reassigned > 0 AND NOT p_confirm_reassignment THEN
    RAISE EXCEPTION 'ACCOUNT_REASSIGNMENT_CONFIRMATION_REQUIRED:%', array_to_string(v_conflicts, ',')
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ad_accounts
  SET client_id = NULL
  WHERE org_id = p_org_id
    AND platform = p_platform
    AND client_id = p_client_id
    AND NOT (external_id = ANY(v_external_ids));
  GET DIAGNOSTICS v_unlinked = ROW_COUNT;

  UPDATE public.ad_accounts
  SET client_id = p_client_id,
      status = CASE WHEN status = 'disconnected' THEN status ELSE 'active' END
  WHERE org_id = p_org_id
    AND platform = p_platform
    AND external_id = ANY(v_external_ids);
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  RETURN QUERY SELECT v_linked, v_unlinked, v_reassigned;
END;
$$;

REVOKE ALL ON FUNCTION public.set_client_ad_accounts(UUID, UUID, TEXT, TEXT[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_client_ad_accounts(UUID, UUID, TEXT, TEXT[], BOOLEAN)
  TO authenticated, service_role;
