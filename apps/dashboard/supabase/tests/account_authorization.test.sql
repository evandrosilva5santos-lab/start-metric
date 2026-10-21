-- Execute depois das migrations. Falha com EXCEPTION se o contrato não estiver instalado.
DO $$
BEGIN
  IF to_regclass('public.operational_ad_accounts') IS NULL THEN
    RAISE EXCEPTION 'operational_ad_accounts ausente';
  END IF;
  IF to_regprocedure('public.set_client_ad_accounts(uuid,uuid,text,text[],boolean)') IS NULL THEN
    RAISE EXCEPTION 'set_client_ad_accounts ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ad_accounts_org_client_id_fkey'
      AND conrelid = 'public.ad_accounts'::regclass
  ) THEN
    RAISE EXCEPTION 'FK same-org ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ad_accounts_org_platform_external_id_key'
      AND conrelid = 'public.ad_accounts'::regclass
  ) THEN
    RAISE EXCEPTION 'unicidade por plataforma ausente';
  END IF;
END
$$;
