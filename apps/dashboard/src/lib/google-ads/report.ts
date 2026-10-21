// Server-side ONLY. Dados do painel Google Ads: indicadores, comparação, série diária e campanhas.

import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeMetrics, type MetricSummary, type MetricTotals } from "./gaql";

type Db = SupabaseClient;

const PAGE = 1000;
const MAX_ROWS = 20_000;

type MetricRow = {
  ad_account_id: string;
  campaign_id: string;
  date: string;
  cost_micros: number | string;
  impressions: number | string;
  clicks: number | string;
  conversions: number | string;
  conversions_value: number | string;
};

const toTotals = (r: MetricRow): MetricTotals => ({
  costMicros: Number(r.cost_micros),
  impressions: Number(r.impressions),
  clicks: Number(r.clicks),
  conversions: Number(r.conversions),
  conversionsValue: Number(r.conversions_value),
});

export type GoogleReportAccount = { id: string; externalId: string; name: string; currency: string; clientId: string | null; clientName: string | null; status: string; lastSyncedAt: string | null };

export type GoogleReport = {
  from: string;
  to: string;
  previous: { from: string; to: string };
  accounts: GoogleReportAccount[];
  clients: Array<{ id: string; name: string }>;
  currency: string;
  summary: MetricSummary;
  previousSummary: MetricSummary;
  daily: Array<{ date: string; spend: number; clicks: number; conversions: number }>;
  campaigns: Array<{
    campaignId: string;
    accountName: string;
    name: string;
    status: string | null;
    channelType: string | null;
    dailyBudget: number | null;
    metrics: MetricSummary;
  }>;
  truncated: boolean;
};

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function spanDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

async function metricRows(db: Db, orgId: string, accountIds: string[], from: string, to: string): Promise<{ rows: MetricRow[]; truncated: boolean }> {
  const rows: MetricRow[] = [];
  if (accountIds.length === 0) return { rows, truncated: false };
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await db
      .from("google_ads_daily_metrics")
      .select("ad_account_id, campaign_id, date, cost_micros, impressions, clicks, conversions, conversions_value")
      .eq("org_id", orgId)
      .in("ad_account_id", accountIds)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`métricas Google: ${error.message}`);
    rows.push(...((data ?? []) as MetricRow[]));
    if (!data || data.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export async function getGoogleReport(
  db: Db,
  params: { orgId: string; from: string; to: string; clientId?: string | null; accountId?: string | null },
): Promise<GoogleReport> {
  const [{ data: accountData, error: accountError }, { data: clientData }] = await Promise.all([
    db
      .from("ad_accounts")
      .select("id, external_id, name, currency, client_id, status, last_synced_at")
      .eq("org_id", params.orgId)
      .eq("platform", "google")
      .order("name"),
    db.from("clients").select("id, name").eq("org_id", params.orgId).is("archived_at", null).order("name"),
  ]);
  if (accountError) throw new Error(`contas Google: ${accountError.message}`);

  const clients = (clientData ?? []) as Array<{ id: string; name: string }>;
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const accounts: GoogleReportAccount[] = ((accountData ?? []) as Array<Record<string, string | null>>).map((a) => ({
    id: a.id!,
    externalId: a.external_id!,
    name: a.name ?? a.external_id!,
    currency: a.currency ?? "BRL",
    clientId: a.client_id,
    clientName: a.client_id ? clientName.get(a.client_id) ?? null : null,
    status: a.status ?? "active",
    lastSyncedAt: a.last_synced_at,
  }));

  const scoped = accounts.filter(
    (a) => a.status === "active" && (!params.accountId || a.id === params.accountId) && (!params.clientId || a.clientId === params.clientId),
  );
  const ids = scoped.map((a) => a.id);
  const days = spanDays(params.from, params.to);
  const previous = { from: shiftDay(params.from, -days), to: shiftDay(params.from, -1) };

  const [current, before, campaignResult] = await Promise.all([
    metricRows(db, params.orgId, ids, params.from, params.to),
    metricRows(db, params.orgId, ids, previous.from, previous.to),
    ids.length
      ? db
          .from("google_ads_campaigns")
          .select("ad_account_id, campaign_id, name, status, channel_type, budget_micros, budget_period")
          .eq("org_id", params.orgId)
          .in("ad_account_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (campaignResult.error) throw new Error(`campanhas Google: ${campaignResult.error.message}`);

  const byDay = new Map<string, MetricTotals[]>();
  const byCampaign = new Map<string, MetricTotals[]>();
  for (const row of current.rows) {
    const t = toTotals(row);
    byDay.set(row.date, [...(byDay.get(row.date) ?? []), t]);
    const key = `${row.ad_account_id}|${row.campaign_id}`;
    byCampaign.set(key, [...(byCampaign.get(key) ?? []), t]);
  }

  const accountName = new Map(scoped.map((a) => [a.id, a.name]));
  const campaigns = ((campaignResult.data ?? []) as Array<Record<string, string | number | null>>)
    .map((c) => {
      const key = `${c.ad_account_id}|${c.campaign_id}`;
      const budget = c.budget_micros === null ? null : Number(c.budget_micros) / 1_000_000;
      return {
        campaignId: String(c.campaign_id),
        accountName: accountName.get(String(c.ad_account_id)) ?? "",
        name: String(c.name),
        status: (c.status as string | null) ?? null,
        channelType: (c.channel_type as string | null) ?? null,
        dailyBudget: c.budget_period === "DAILY" ? budget : null,
        metrics: summarizeMetrics(byCampaign.get(key) ?? []),
      };
    })
    .sort((a, b) => b.metrics.spend - a.metrics.spend);

  const daily: GoogleReport["daily"] = [];
  for (let day = params.from; day <= params.to; day = shiftDay(day, 1)) {
    const s = summarizeMetrics(byDay.get(day) ?? []);
    daily.push({ date: day, spend: s.spend, clicks: s.clicks, conversions: s.conversions });
  }

  const currencies = new Set(scoped.map((a) => a.currency));
  return {
    from: params.from,
    to: params.to,
    previous,
    accounts,
    clients: clients.filter((c) => accounts.some((a) => a.clientId === c.id)),
    currency: currencies.size === 1 ? [...currencies][0] : "BRL",
    summary: summarizeMetrics(current.rows.map(toTotals)),
    previousSummary: summarizeMetrics(before.rows.map(toTotals)),
    daily,
    campaigns,
    truncated: current.truncated,
  };
}
