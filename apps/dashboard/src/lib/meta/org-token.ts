import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { decryptToken } from "@/lib/meta/token";
import { fetchAdAccounts, type MetaAdAccountSummary } from "@/lib/meta/client";

type DbClient = SupabaseClient<Database>;

export type OrgMetaToken = {
  token: string;
  tokenEncrypted: string;
  tokenExpiresAt: string | null;
};

/**
 * Token da conexão Meta da própria organização (o OAuth grava o mesmo token
 * cifrado em cada conta). Nunca usa token do servidor: sem conexão, null.
 */
export async function getOrgMetaToken(supabase: DbClient, orgId: string): Promise<OrgMetaToken | null> {
  const { data } = await supabase
    .from("ad_accounts")
    .select("token_encrypted, token_expires_at")
    .eq("org_id", orgId)
    .eq("platform", "meta")
    .eq("status", "active")
    .not("token_encrypted", "is", null)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const envToken =
    process.env.META_TOKEN ||
    process.env.META_SYSTEM_TOKEN ||
    process.env.META_USER_TOKEN;

  if (!data?.token_encrypted) {
    if (envToken) {
      return { token: envToken, tokenEncrypted: "env_token", tokenExpiresAt: null };
    }
    return null;
  }
  try {
    const token = await decryptToken(data.token_encrypted, supabase);
    return { token, tokenEncrypted: data.token_encrypted, tokenExpiresAt: data.token_expires_at ?? null };
  } catch (err) {
    console.error("[meta/org-token] Falha ao abrir o token da organização:", err);
    if (envToken) {
      return { token: envToken, tokenEncrypted: "env_token", tokenExpiresAt: null };
    }
    return null;
  }
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const accountsCache = new Map<string, { at: number; accounts: MetaAdAccountSummary[] }>();

/** Todas as contas que a conexão Meta da organização enxerga, com cache curto por organização. */
export async function listOrgMetaAccounts(orgId: string, token: string, fresh = false): Promise<MetaAdAccountSummary[]> {
  const cached = accountsCache.get(orgId);
  if (!fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.accounts;
  const accounts = await fetchAdAccounts(token);
  accountsCache.set(orgId, { at: Date.now(), accounts });
  return accounts;
}
