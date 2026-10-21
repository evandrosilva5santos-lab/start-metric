-- Regra canônica: Integração descobre; Carteira autoriza; Operação consome.

-- O mesmo external_id pode existir em plataformas diferentes.
ALTER TABLE public.ad_accounts
  DROP CONSTRAINT IF EXISTS ad_accounts_org_id_external_id_key;

ALTER TABLE public.ad_accounts
  ADD CONSTRAINT ad_accounts_org_platform_external_id_key
  UNIQUE (org_id, platform, external_id);

-- Permite uma FK composta que garanta cliente e conta no mesmo tenant.
ALTER TABLE public.clients
  ADD CONSTRAINT clients_org_id_id_key UNIQUE (org_id, id);

ALTER TABLE public.ad_accounts
  DROP CONSTRAINT IF EXISTS ad_accounts_org_client_id_fkey;

ALTER TABLE public.ad_accounts
  ADD CONSTRAINT ad_accounts_org_client_id_fkey
  FOREIGN KEY (org_id, client_id)
  REFERENCES public.clients (org_id, id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS idx_ad_accounts_operational
  ON public.ad_accounts (org_id, client_id, platform, status)
  WHERE client_id IS NOT NULL AND status = 'active';

-- A view herda RLS das tabelas-base (Postgres 15+: security_invoker).
CREATE OR REPLACE VIEW public.operational_ad_accounts
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.org_id,
  a.client_id,
  a.platform,
  a.external_id,
  a.name,
  a.currency,
  a.timezone,
  a.status,
  a.connected_at,
  a.last_synced_at,
  c.name AS client_name
FROM public.ad_accounts a
JOIN public.clients c
  ON c.id = a.client_id
 AND c.org_id = a.org_id
WHERE a.client_id IS NOT NULL
  AND a.status = 'active'
  AND c.archived_at IS NULL;

COMMENT ON VIEW public.operational_ad_accounts IS
  'Fonte canônica de contas autorizadas pela Carteira para superfícies operacionais.';

REVOKE ALL ON public.operational_ad_accounts FROM PUBLIC;
GRANT SELECT ON public.operational_ad_accounts TO authenticated, service_role;

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

