// lib/meta/token.ts — Server-side ONLY
// Criptografia de tokens de terceiros usando pgcrypto do Supabase.
// NUNCA importe em Client Components ou resolvers client-side.

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

function getEncryptionKey(): string {
  const key = process.env.SUPABASE_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "SUPABASE_ENCRYPTION_KEY deve ter no mínimo 32 caracteres. " +
      "Configure-a em .env.local (nunca no client bundle)."
    );
  }
  return key;
}

/**
 * Criptografa um access_token bruto usando pgp_sym_encrypt do pgcrypto.
 * Retorna a string cifrada para armazenar em ad_accounts.token_encrypted.
 *
 * Executa a criptografia no Supabase (server SQL), não no runtime Node.js,
 * para aproveitar pgcrypto sem instalar dependências nativas.
 */
export async function encryptToken(rawToken: string, client?: DbClient): Promise<string> {
  const supabase = client ?? await createClient();
  const key = getEncryptionKey();

  // pgp_sym_encrypt usa AES-256 com passphrase via pgcrypto
  const { data, error } = await supabase.rpc("encrypt_token", {
    raw_token: rawToken,
    encryption_key: key,
  });

  if (error) {
    throw new Error(`Falha ao criptografar token: ${error.message}`);
  }

  return data as string;
}

/**
 * Descriptografa um token armazenado em ad_accounts.token_encrypted.
 * Retorna o access_token bruto para uso em chamadas server-side da Graph API.
 */
export async function decryptToken(encryptedToken: string, client?: DbClient): Promise<string> {
  const supabase = client ?? await createClient();
  const key = getEncryptionKey();

  const { data, error } = await supabase.rpc("decrypt_token", {
    encrypted_token: encryptedToken,
    encryption_key: key,
  });

  if (error) {
    throw new Error(`Falha ao descriptografar token: ${error.message}`);
  }

  return data as string;
}

// ── SQL functions necessárias (executar no Supabase SQL Editor) ──────────────
//
// CREATE OR REPLACE FUNCTION encrypt_token(raw_token TEXT, encryption_key TEXT)
// RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
//   SELECT encode(pgp_sym_encrypt(raw_token, encryption_key), 'base64');
// $$;
//
// CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token TEXT, encryption_key TEXT)
// RETURNS TEXT LANGUAGE sql SECURITY DEFINER AS $$
//   SELECT pgp_sym_decrypt(decode(encrypted_token, 'base64'), encryption_key);
// $$;
//
// Essas funções também estão na migration 20260307000002_meta_ads_tables.sql
