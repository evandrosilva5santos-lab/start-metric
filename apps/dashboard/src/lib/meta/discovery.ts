import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { MetaApiError, type MetaAdAccountSummary } from "@/lib/meta/client";
import {
  getOrgMetaToken,
  listOrgMetaAccounts,
  markOrgMetaConnectionExpired,
  orgMetaAccessFailure,
  type OrgMetaToken,
} from "@/lib/meta/org-token";
import type { PanelAccountState } from "@/lib/meta/account-groups";

type DbClient = SupabaseClient<Database>;

export type DiscoveryFailureCode = "meta_not_connected" | "meta_token_expired" | "meta_unavailable" | "meta_rate_limited";

export type DiscoveryResult =
  | { ok: true; token: OrgMetaToken; accounts: MetaAdAccountSummary[] }
  | { ok: false; code: DiscoveryFailureCode };

const FAILURES: Record<DiscoveryFailureCode, { status: number; message: string }> = {
  meta_not_connected: {
    status: 409,
    message: "Conecte a Meta da sua organização em Configurações > Meta para buscar as contas.",
  },
  meta_token_expired: {
    status: 409,
    message: "A conexão com a Meta expirou. Conecte de novo em Configurações > Meta.",
  },
  meta_unavailable: { status: 502, message: "A Meta não respondeu agora. Tente de novo em alguns minutos." },
  meta_rate_limited: { status: 429, message: "A Meta limitou as consultas por alguns minutos. Tente de novo em instantes." },
};

export function discoveryFailureResponse(code: DiscoveryFailureCode): NextResponse {
  const failure = FAILURES[code];
  return NextResponse.json({ error: failure.message, code }, { status: failure.status });
}

export async function discoverOrgAccounts(db: DbClient, orgId: string, fresh = false): Promise<DiscoveryResult> {
  const token = await getOrgMetaToken(db, orgId);
  if (!token) return { ok: false, code: await orgMetaAccessFailure(db, orgId) };

  try {
    const accounts = await listOrgMetaAccounts(orgId, token.token, fresh);
    return { ok: true, token, accounts };
  } catch (err) {
    if (err instanceof MetaApiError && err.isTokenExpired()) {
      await markOrgMetaConnectionExpired(db, orgId, token.tokenEncrypted);
      return { ok: false, code: "meta_token_expired" };
    }
    if (err instanceof MetaApiError && err.isRateLimited()) return { ok: false, code: "meta_rate_limited" };
    console.error("[meta/discovery] Falha ao listar contas na Meta:", err instanceof Error ? err.message : err);
    return { ok: false, code: "meta_unavailable" };
  }
}

export type PanelAccountRow = {
  id: string;
  externalId: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
};

export async function loadPanelAccounts(db: DbClient, orgId: string): Promise<PanelAccountRow[]> {
  const [accountsResult, clientsResult] = await Promise.all([
    db.from("ad_accounts").select("id, external_id, status, client_id").eq("org_id", orgId).eq("platform", "meta"),
    db.from("clients").select("id, name").eq("org_id", orgId).is("archived_at", null),
  ]);
  if (accountsResult.error || clientsResult.error) {
    throw new Error(accountsResult.error?.message ?? clientsResult.error?.message ?? "Falha ao ler contas do painel.");
  }
  const clientNames = new Map((clientsResult.data ?? []).map((client) => [client.id, client.name]));
  return (accountsResult.data ?? []).map((row) => ({
    id: row.id,
    externalId: row.external_id,
    status: row.status,
    clientId: row.client_id,
    clientName: row.client_id ? (clientNames.get(row.client_id) ?? null) : null,
  }));
}

export function toPanelStates(rows: PanelAccountRow[]): PanelAccountState[] {
  return rows.map((row) => ({ externalId: row.externalId, status: row.status, clientName: row.clientName }));
}
