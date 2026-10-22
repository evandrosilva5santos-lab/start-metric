import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/meta/token";
import { getOrgMetaToken } from "@/lib/meta/org-token";
import { fetchAccountInsightMetrics, fetchTopCreatives } from "@/lib/reports/engine/insights";
import { listOperationalAccounts } from "@/lib/accounts/operational";
import { fetchKeywordSummary } from "@/lib/google-ads/service";
import type { DailyMetricRow, GoogleDailyRow } from "@/lib/reports/engine/metrics";
import type { AccountInfo, DateRange, PartDataSource, PartInput, ReportInput } from "@/lib/reports/generate-core";
import type { ReportPeriod } from "@/lib/reports/period";

export type ReportsDb = SupabaseClient<Database>;

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
type AccountRow = Pick<Database["public"]["Tables"]["ad_accounts"]["Row"], "id" | "external_id" | "client_id" | "platform" | "currency" | "name">;
type PartRow = Database["public"]["Tables"]["report_parts"]["Row"];

export function createReportsAdminDb(): ReportsDb {
  return createAdminClient() as unknown as ReportsDb;
}

function toAccountInfo(row: AccountRow): AccountInfo {
  return { id: row.id, externalId: row.external_id, clientId: row.client_id, platform: row.platform, currency: row.currency, name: row.name };
}

export function toPartInput(row: PartRow): PartInput {
  return {
    position: row.position,
    adAccountId: row.ad_account_id,
    period: row.period as ReportPeriod,
    customStart: row.custom_start,
    customEnd: row.custom_end,
    body: row.body,
    sendWithoutData: row.send_without_data,
  };
}

export async function loadReportForGeneration(db: ReportsDb, orgId: string, reportId: string): Promise<ReportInput | null> {
  const { data, error } = await db
    .from("reports")
    .select("id, client_id, timezone, clients(name, archived_at), report_parts(*)")
    .eq("id", reportId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o relatório: ${error.message}`);
  if (!data || data.clients?.archived_at) return null;
  return {
    id: data.id,
    clientId: data.client_id,
    clientName: data.clients?.name ?? null,
    timezone: data.timezone,
    parts: (data.report_parts ?? []).map(toPartInput),
  };
}

export async function loadAccounts(
  db: ReportsDb,
  orgId: string,
  clientId: string | null,
  extraIds: readonly string[],
): Promise<AccountInfo[]> {
  if (!clientId) return [];
  const inventory = await listOperationalAccounts(db, orgId);
  const requested = new Set(extraIds);
  return inventory.accounts
    .filter(
      (account) =>
        account.client_id === clientId &&
        (requested.size === 0 || requested.has(account.id)),
    )
    .map((account) => toAccountInfo(account as AccountRow));
}

async function loadDailyRows(db: ReportsDb, orgId: string, accountIds: readonly string[], range: DateRange): Promise<DailyMetricRow[]> {
  const rows: DailyMetricRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await db
      .from("daily_metrics")
      .select("id, spend, impressions, clicks, conversions, revenue_attributed, actions, action_values, campaigns!inner(ad_account_id)")
      .eq("org_id", orgId)
      .in("campaigns.ad_account_id", [...accountIds])
      .gte("date", range.since)
      .lte("date", range.until)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Falha ao ler métricas diárias: ${error.message}`);
    rows.push(...((data ?? []) as unknown as DailyMetricRow[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
  throw new Error("Período com dados demais para um relatório; reduza o intervalo.");
}

// As tabelas do Google ainda não estão nos tipos gerados do Supabase.
const GOOGLE_COLUMNS = [
  "ad_account_id, campaign_id, date, cost_micros, impressions, clicks, conversions, conversions_value",
  "interactions, all_conversions, all_conversions_value, search_impression_share",
  "search_budget_lost_impression_share, search_rank_lost_impression_share, content_budget_lost_impression_share",
  "top_impression_percentage, absolute_top_impression_percentage, video_views, video_view_rate",
].join(", ");

async function loadGoogleRows(db: ReportsDb, orgId: string, accountIds: readonly string[], range: DateRange): Promise<GoogleDailyRow[]> {
  const rows: GoogleDailyRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await (db as unknown as SupabaseClient)
      .from("google_ads_daily_metrics")
      .select(GOOGLE_COLUMNS)
      .eq("org_id", orgId)
      .in("ad_account_id", [...accountIds])
      .gte("date", range.since)
      .lte("date", range.until)
      .order("date")
      .order("campaign_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Falha ao ler métricas do Google: ${error.message}`);
    rows.push(...((data ?? []) as unknown as GoogleDailyRow[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
  throw new Error("Período com dados demais para um relatório; reduza o intervalo.");
}

async function loadAccountToken(db: ReportsDb, orgId: string, accountId: string): Promise<string | null> {
  const { data } = await db
    .from("ad_accounts")
    .select("token_encrypted")
    .eq("id", accountId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (data?.token_encrypted) {
    try {
      return await decryptToken(data.token_encrypted, db);
    } catch (err) {
      console.error("[reports/data] Falha ao abrir o token da conta:", err instanceof Error ? err.message : err);
    }
  }
  return (await getOrgMetaToken(db, orgId))?.token ?? null;
}

export function createPartDataSource(db: ReportsDb, orgId: string): PartDataSource {
  const tokens = new Map<string, Promise<string | null>>();
  const tokenFor = async (account: AccountInfo): Promise<string> => {
    if (!tokens.has(account.id)) tokens.set(account.id, loadAccountToken(db, orgId, account.id));
    const token = await tokens.get(account.id);
    if (!token) throw new Error("Sem token da Meta para esta conta. Reconecte em Configurações > Meta Ads.");
    return token;
  };

  return {
    loadDailyRows: (accountIds, range) => loadDailyRows(db, orgId, accountIds, range),
    loadGoogleRows: (accountIds, range) => loadGoogleRows(db, orgId, accountIds, range),
    loadInsightMetrics: async (account, range) =>
      fetchAccountInsightMetrics({ accountId: account.externalId, token: await tokenFor(account), ...range }),
    loadTopCreatives: async (account, range) =>
      fetchTopCreatives({ accountId: account.externalId, token: await tokenFor(account), ...range }),
    loadGoogleKeywords: (account, range) => fetchKeywordSummary(db as never, orgId, account.externalId, range),
  };
}
