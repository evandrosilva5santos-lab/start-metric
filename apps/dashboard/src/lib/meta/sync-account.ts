import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchCampaigns, fetchCampaignInsights, MetaApiError, type ParsedMetric } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/token";
import { getOrgMetaToken, markOrgMetaConnectionExpired } from "@/lib/meta/org-token";
import { toDailyMetricRow, upsertDailyMetrics } from "@/lib/meta/daily-metrics";
import { classifyMetaErrorCode, type MetaFailureKind } from "@/lib/meta/sync-plan";

type DbClient = SupabaseClient<Database>;

export type SyncTarget = {
  id: string;
  org_id: string;
  external_id: string;
  token_encrypted: string | null;
};

export type ResolvedToken = { token: string; tokenEncrypted: string };

export type AccountSyncCounts = { campaigns: number; metrics: number };

export function metaFailureKind(err: unknown): MetaFailureKind {
  return err instanceof MetaApiError ? classifyMetaErrorCode(err.code) : "error";
}

function uniqueByCampaignDay(metrics: readonly ParsedMetric[]): ParsedMetric[] {
  return [...new Map(metrics.map((metric) => [`${metric.campaign_id}|${metric.date}`, metric])).values()];
}

async function fetchInsightsFor(externalId: string, token: string, presets: readonly string[]): Promise<ParsedMetric[]> {
  const batches = await Promise.all(presets.map((preset) => fetchCampaignInsights(externalId, token, preset)));
  return uniqueByCampaignDay(batches.flat());
}

export async function syncAccountMetrics(
  db: DbClient,
  account: SyncTarget,
  token: string,
  presets: readonly string[],
): Promise<AccountSyncCounts> {
  const campaigns = await fetchCampaigns(account.external_id, token);
  if (campaigns.length > 0) {
    const { error } = await db.from("campaigns").upsert(
      campaigns.map((c) => ({
        ad_account_id: account.id,
        org_id: account.org_id,
        meta_id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
      })),
      { onConflict: "ad_account_id,meta_id" },
    );
    if (error) console.error(`[meta/sync-account] Erro upsert campaigns (${account.external_id}):`, error.message);
  }

  const insights = await fetchInsightsFor(account.external_id, token, presets);
  const { data: campaignRows, error: idsError } = await db
    .from("campaigns")
    .select("id, meta_id")
    .eq("ad_account_id", account.id);
  if (idsError) throw new Error(`Falha ao ler campanhas: ${idsError.message}`);

  const idMap = new Map((campaignRows ?? []).map((row) => [row.meta_id, row.id]));
  const metricRows = insights
    .filter((insight) => idMap.has(insight.campaign_id))
    .map((insight) => toDailyMetricRow(insight, idMap.get(insight.campaign_id)!, account.org_id));

  const { error: metricsError, legacy } = await upsertDailyMetrics(db, metricRows);
  if (legacy) console.warn("[meta/sync-account] daily_metrics sem colunas actions/action_values; gravado sem conversões por tipo.");
  if (metricsError) throw new Error(`Falha ao gravar daily_metrics: ${metricsError.message}`);

  const { error: stampError } = await db
    .from("ad_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", account.id);
  if (stampError) throw new Error(`Falha ao marcar last_synced_at: ${stampError.message}`);

  return { campaigns: campaigns.length, metrics: metricRows.length };
}

export async function markAccountExpired(db: DbClient, account: SyncTarget, tokenEncrypted: string | null): Promise<void> {
  const { error } = await db.from("ad_accounts").update({ status: "expired" }).eq("id", account.id);
  if (error) console.error(`[meta/sync-account] Não foi possível marcar ${account.external_id} como expirada:`, error.message);
  if (tokenEncrypted) await markOrgMetaConnectionExpired(db, account.org_id, tokenEncrypted);
}

export function createTokenResolver(db: DbClient): (account: SyncTarget) => Promise<ResolvedToken | null> {
  const byEncrypted = new Map<string, Promise<ResolvedToken | null>>();
  const byOrg = new Map<string, Promise<ResolvedToken | null>>();

  const fromAccount = (encrypted: string) =>
    decryptToken(encrypted, db)
      .then((token) => ({ token, tokenEncrypted: encrypted }))
      .catch((err: unknown) => {
        console.error("[meta/sync-account] Falha ao abrir token da conta:", err instanceof Error ? err.message : err);
        return null;
      });

  const fromOrg = (orgId: string) =>
    getOrgMetaToken(db, orgId).then((found) => (found ? { token: found.token, tokenEncrypted: found.tokenEncrypted } : null));

  const orgToken = (orgId: string) => {
    if (!byOrg.has(orgId)) byOrg.set(orgId, fromOrg(orgId));
    return byOrg.get(orgId)!;
  };

  return async (account) => {
    const key = account.token_encrypted;
    if (!key) return orgToken(account.org_id);
    if (!byEncrypted.has(key)) byEncrypted.set(key, fromAccount(key));
    return (await byEncrypted.get(key)!) ?? orgToken(account.org_id);
  };
}
