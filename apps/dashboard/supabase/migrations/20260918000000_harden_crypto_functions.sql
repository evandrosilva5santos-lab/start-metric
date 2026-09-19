-- ============================================================
-- MIGRATION: Hardening das funções SECURITY DEFINER de criptografia
-- Pinar search_path impede sequestro de funções (encode/decode/
-- pgp_sym_encrypt) via schemas maliciosos no search_path do caller.
-- Ref: padrão OWASP/CWE-909 para SECURITY DEFINER no Postgres.
-- ============================================================

CREATE OR REPLACE FUNCTION encrypt_token(
  raw_token       TEXT,
  encryption_key  TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT encode(
    pgp_sym_encrypt(raw_token, encryption_key)::bytea,
    'base64'
  );
$$;

CREATE OR REPLACE FUNCTION decrypt_token(
  encrypted_token TEXT,
  encryption_key  TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    encryption_key
  );
$$;

-- Permissões mantidas: apenas service_role e authenticated (a chave
-- protege o uso indevido; anon continua sem acesso).
REVOKE ALL ON FUNCTION encrypt_token(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION decrypt_token(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION encrypt_token(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION decrypt_token(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION encrypt_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION encrypt_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_token(TEXT, TEXT) TO authenticated;
