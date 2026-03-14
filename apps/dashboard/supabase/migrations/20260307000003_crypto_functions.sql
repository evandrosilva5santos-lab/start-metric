-- ============================================================
-- MIGRATION: Funções RPC de criptografia de tokens (ADR-006)
-- encrypt_token / decrypt_token via pgcrypto
-- SECURITY DEFINER: executam com privilégios do owner, não do caller.
-- A chave de criptografia é passada pelo server-side (nunca client).
-- ============================================================

-- Garante extensão pgcrypto disponível
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── encrypt_token ─────────────────────────────────────────────
-- Criptografa um access_token bruto com pgp_sym_encrypt.
-- Uso exclusivo server-side (lib/meta/token.ts).
CREATE OR REPLACE FUNCTION encrypt_token(
  raw_token       TEXT,
  encryption_key  TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT encode(
    pgp_sym_encrypt(raw_token, encryption_key)::bytea,
    'base64'
  );
$$;

COMMENT ON FUNCTION encrypt_token IS
  'Criptografa access_token com pgp_sym_encrypt(AES-256). '
  'SECURITY DEFINER — nunca chamar do client-side. '
  'Retorna base64 para armazenamento seguro em ad_accounts.token_encrypted.';

-- ── decrypt_token ─────────────────────────────────────────────
-- Descriptografa o token armazenado para uso em chamadas server-side.
-- Uso exclusivo server-side (lib/meta/token.ts → fetchCampaigns, etc).
CREATE OR REPLACE FUNCTION decrypt_token(
  encrypted_token TEXT,
  encryption_key  TEXT
)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgp_sym_decrypt(
    decode(encrypted_token, 'base64'),
    encryption_key
  );
$$;

COMMENT ON FUNCTION decrypt_token IS
  'Descriptografa token armazenado em ad_accounts.token_encrypted. '
  'SECURITY DEFINER — nunca chamar do client-side. '
  'Recebe base64 gerado por encrypt_token e retorna o access_token bruto.';

-- ── Revogar acesso público às funções ─────────────────────────
-- Apenas funções server-side com a chave correta podem chamar.
REVOKE ALL ON FUNCTION encrypt_token(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION decrypt_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION encrypt_token(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_token(TEXT, TEXT) TO service_role;
-- anon/authenticated precisam chamar via API routes (nunca direto)
GRANT EXECUTE ON FUNCTION encrypt_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_token(TEXT, TEXT) TO authenticated;
