import "server-only";

import type { getServerSupabase } from "@/lib/auth/session";
import type { DashboardContext } from "./queries";

type SupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

type MetricRow = {
  date: string;
  campaign_id: string;
  spend: number | null;
  revenue_attributed: number | null;
  conversions: number | null;
  impressions: number | null;
  clicks: number | null;
};

export type Totals = {
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
};

export type Rollup = {
  byCampaign: Map<string, Totals>;
  byDay: Map<string, Totals>;
};

export const DEV_TIMING = process.env.NODE_ENV === "development";

export async function timed<T>(label: string, run: () => PromiseLike<T>): Promise<T> {
  if (!DEV_TIMING) return run();
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    console.info(`[dashboard] ${label}: ${Math.round(performance.now() - startedAt)}ms`);
  }
}

export function emptyTotals(): Totals {
  return { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 };
}

export function addTotals(target: Totals, source: Totals) {
  target.spend += source.spend;
  target.revenue += source.revenue;
  target.conversions += source.conversions;
  target.impressions += source.impressions;
  target.clicks += source.clicks;
}

function toNumber(value: number | null | undefined): number {
  if (typeof value !== "number") return 0;
  return Number.isFinite(value) ? value : 0;
}

export async function fetchRollup(
  supabase: SupabaseClient,
  context: DashboardContext,
): Promise<Rollup> {
  const campaignIds = context.campaigns.map((campaign) => campaign.id);
  const { from, to } = context.range;

  const rpc = await timed("metrics rollup (rpc)", () =>
    supabase.rpc("dashboard_metrics_rollup", {
      p_org_id: context.orgId,
      p_from: from,
      p_to: to,
      p_campaign_ids: campaignIds,
    }),
  );

  if (!rpc.error) {
    const rollup: Rollup = { byCampaign: new Map(), byDay: new Map() };
    for (const row of rpc.data ?? []) {
      const totals: Totals = {
        spend: Number(row.spend) || 0,
        revenue: Number(row.revenue) || 0,
        conversions: Number(row.conversions) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
      };
      (row.kind === "day" ? rollup.byDay : rollup.byCampaign).set(row.key, totals);
    }
    return rollup;
  }

  // Sem a migração aplicada: soma as linhas diárias aqui, como antes.
  if (DEV_TIMING) {
    console.warn(`[dashboard] RPC indisponível, usando soma em JS: ${rpc.error.message}`);
  }

  let metricsQuery = supabase
    .from("daily_metrics")
    .select("date, campaign_id, spend, revenue_attributed, conversions, impressions, clicks")
    .eq("org_id", context.orgId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  const { adAccountId, campaignStatuses, campaignObjectives } = context.filters;
  const hasSpecificFilter =
    adAccountId !== "all" || campaignStatuses.length > 0 || campaignObjectives.length > 0;
  if (hasSpecificFilter && campaignIds.length <= 100) {
    metricsQuery = metricsQuery.in("campaign_id", campaignIds);
  }

  const { data: metricsData, error: metricsError } = await timed("metrics rows", () => metricsQuery);
  if (metricsError) {
    throw new Error(`METRICS_ERROR:${metricsError.message}`);
  }

  const known = new Set(campaignIds);
  const rollup: Rollup = { byCampaign: new Map(), byDay: new Map() };
  for (const metric of (metricsData ?? []) as MetricRow[]) {
    if (!known.has(metric.campaign_id)) continue;
    const totals: Totals = {
      spend: toNumber(metric.spend),
      revenue: toNumber(metric.revenue_attributed),
      conversions: toNumber(metric.conversions),
      impressions: toNumber(metric.impressions),
      clicks: toNumber(metric.clicks),
    };

    const campaignTotals = rollup.byCampaign.get(metric.campaign_id) ?? emptyTotals();
    addTotals(campaignTotals, totals);
    rollup.byCampaign.set(metric.campaign_id, campaignTotals);

    const dayTotals = rollup.byDay.get(metric.date) ?? emptyTotals();
    addTotals(dayTotals, totals);
    rollup.byDay.set(metric.date, dayTotals);
  }
  return rollup;
}
