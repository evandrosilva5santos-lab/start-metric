import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { decryptToken } from "@/lib/meta/token";
import { fetchAdAccounts, type MetaAdAccountSummary } from "@/lib/meta/client";

type DbClient = SupabaseClient<Database>;

// Versões antigas gravavam este marcador no lugar de um token real quando caíam no token do servidor.
const LEGACY_ENV_TOKEN_MARKER = "env_token";

export type OrgMetaToken = {
  token: string;
  tokenEncrypted: string;
  tokenExpiresAt: string | null;
};

export type OrgMetaAccessFailure = "meta_not_connected" | "meta_token_expired";

type StoredToken = { token_encrypted: string | null; token_expires_at: string | null };

async function connectionToken(supabase: DbClient, orgId: string): Promise<StoredToken | null> {
  const { data, error } = await supabase
    .from("meta_connections")
    .select("token_encrypted, token_expires_at")
    .eq("org_id", orgId)
    .eq("status", "active")
    .neq("token_encrypted", LEGACY_ENV_TOKEN_MARKER)
    .maybeSingle();
  if (error) {
    console.warn("[meta/org-token] meta_connections indisponível, usando as contas:", error.message);
    return null;
  }
  return data;
}

async function legacyAccountToken(supabase: DbClient, orgId: string): Promise<StoredToken | null> {
  const { data } = await supabase
    .from("ad_accounts")
    .select("token_encrypted, token_expires_at")
    .eq("org_id", orgId)
    .eq("platform", "meta")
    .eq("status", "active")
    .not("token_encrypted", "is", null)
    .neq("token_encrypted", LEGACY_ENV_TOKEN_MARKER)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/**
 * Token da conexão Meta da própria organização: primeiro meta_connections,
 * depois o token gravado nas contas (conexões anteriores). Nunca usa token do servidor.
 */
export async function getOrgMetaToken(supabase: DbClient, orgId: string): Promise<OrgMetaToken | null> {
  const stored = (await connectionToken(supabase, orgId)) ?? (await legacyAccountToken(supabase, orgId));
  if (!stored?.token_encrypted) return null;
  try {
    const token = await decryptToken(stored.token_encrypted, supabase);
    return { token, tokenEncrypted: stored.token_encrypted, tokenExpiresAt: stored.token_expires_at ?? null };
  } catch (err) {
    console.error("[meta/org-token] Falha ao abrir o token da organização:", err);
    return null;
  }
}

/** Por que a organização está sem token: conexão vencida ou nunca conectada. */
export async function orgMetaAccessFailure(supabase: DbClient, orgId: string): Promise<OrgMetaAccessFailure> {
  const [connection, expiredAccount] = await Promise.all([
    supabase.from("meta_connections").select("status").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("ad_accounts")
      .select("id")
      .eq("org_id", orgId)
      .eq("platform", "meta")
      .eq("status", "expired")
      .limit(1)
      .maybeSingle(),
  ]);
  if (connection.data?.status === "expired" || expiredAccount.data) return "meta_token_expired";
  return "meta_not_connected";
}

export async function markOrgMetaConnectionExpired(supabase: DbClient, orgId: string, tokenEncrypted: string): Promise<void> {
  const { error } = await supabase
    .from("meta_connections")
    .update({ status: "expired" })
    .eq("org_id", orgId)
    .eq("token_encrypted", tokenEncrypted);
  if (error) console.warn("[meta/org-token] Não foi possível marcar a conexão como vencida:", error.message);
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const accountsCache = new Map<string, { at: number; token: string; accounts: MetaAdAccountSummary[] }>();

/** Todas as contas que a conexão Meta da organização enxerga, com cache curto por organização e token. */
export async function listOrgMetaAccounts(orgId: string, token: string, fresh = false): Promise<MetaAdAccountSummary[]> {
  const cached = accountsCache.get(orgId);
  if (!fresh && cached && cached.token === token && Date.now() - cached.at < CACHE_TTL_MS) return cached.accounts;
  const accounts = await fetchAdAccounts(token);
  accountsCache.set(orgId, { at: Date.now(), token, accounts });
  return accounts;
}

export function clearOrgMetaAccountsCache(orgId: string): void {
  accountsCache.delete(orgId);
}
