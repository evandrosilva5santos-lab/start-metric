import "server-only";

import { cache } from "react";
import { getServerSupabase, getSessionProfile, getSessionUser } from "@/lib/auth/session";
import type {
  DashboardCampaignRow,
  DashboardChartPoint,
  DashboardData,
  DashboardFilters,
  DashboardKpis,
} from "./types";

type CampaignRow = {
  id: string;
  name: string;
  status: string | null;
  objective: string | null;
  ad_account_id: string;
};

type MetricRow = {
  date: string;
  campaign_id: string;
  spend: number | null;
  revenue_attributed: number | null;
  conversions: number | null;
  impressions: number | null;
  clicks: number | null;
};

type AccountRow = {
  id: string;
  name: string | null;
  external_id: string;
  timezone: string | null;
};

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function toNumber(value: number | null | undefined): number {
  if (typeof value !== "number") return 0;
  return Number.isFinite(value) ? value : 0;
}

function isValidDate(value: string | undefined): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function subDays(dateIso: string, days: number): string {
  const base = new Date(`${dateIso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString().slice(0, 10);
}

function resolveStatusFilter(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  return values.map(v => v.toUpperCase());
}

type Totals = {
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
};

type Rollup = {
  byCampaign: Map<string, Totals>;
  byDay: Map<string, Totals>;
};

type SupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

export type DashboardContext = Pick<
  DashboardData,
  "timezone" | "range" | "filters" | "filterOptions" | "userProfile"
> & {
  orgId: string;
  accounts: AccountRow[];
  campaigns: CampaignRow[];
};

const DEV_TIMING = process.env.NODE_ENV === "development";

async function timed<T>(label: string, run: () => PromiseLike<T>): Promise<T> {
  if (!DEV_TIMING) return run();
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    console.info(`[dashboard] ${label}: ${Math.round(performance.now() - startedAt)}ms`);
  }
}

function emptyTotals(): Totals {
  return { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 };
}

function addTotals(target: Totals, source: Totals) {
  target.spend += source.spend;
  target.revenue += source.revenue;
  target.conversions += source.conversions;
  target.impressions += source.impressions;
  target.clicks += source.clicks;
}

function uniqueSorted(values: Array<string | null>, transform: (value: string) => string = (v) => v) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)).map(transform)),
  ).sort();
}

// A chave em string permite que o cache() do React reaproveite o resultado
// entre layout, cabeçalho e seções da mesma requisição.
export function filtersKey(filters: DashboardFilters): string {
  return JSON.stringify({
    from: filters.from ?? null,
    to: filters.to ?? null,
    adAccountId: filters.adAccountId ?? null,
    campaignStatuses: filters.campaignStatuses ?? [],
    campaignObjectives: filters.campaignObjectives ?? [],
  });
}

function parseFiltersKey(key: string): DashboardFilters {
  const parsed = JSON.parse(key) as Record<string, unknown>;
  return {
    from: (parsed.from as string | null) ?? undefined,
    to: (parsed.to as string | null) ?? undefined,
    adAccountId: (parsed.adAccountId as string | null) ?? undefined,
    campaignStatuses: parsed.campaignStatuses as string[],
    campaignObjectives: parsed.campaignObjectives as string[],
  };
}

const loadDashboardContext = cache(async (key: string): Promise<DashboardContext> => {
  const inputFilters = parseFiltersKey(key);
  const [user, profile, supabase] = await Promise.all([
    getSessionUser(),
    timed("profile", () => getSessionProfile()),
    getServerSupabase(),
  ]);

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  if (!profile?.orgId) {
    throw new Error("ORG_NOT_FOUND");
  }

  const orgId = profile.orgId;
  const adAccountId = inputFilters.adAccountId ?? "all";
  const campaignStatuses = resolveStatusFilter(inputFilters.campaignStatuses);
  const campaignObjectives = inputFilters.campaignObjectives ?? [];

  let campaignsQuery = supabase
    .from("campaigns")
    .select("id, name, status, objective, ad_account_id")
    .eq("org_id", orgId);

  if (adAccountId !== "all") {
    campaignsQuery = campaignsQuery.eq("ad_account_id", adAccountId);
  }
  if (campaignStatuses.length > 0) {
    campaignsQuery = campaignsQuery.in("status", campaignStatuses);
  }
  if (campaignObjectives.length > 0) {
    campaignsQuery = campaignsQuery.in("objective", campaignObjectives);
  }

  // Contas, organização e campanhas só dependem do org_id: vão juntas.
  const [accountsResult, orgResult, campaignsResult] = await timed("accounts+org+campaigns", () =>
    Promise.all([
      supabase
        .from("ad_accounts")
        .select("id, name, external_id, timezone")
        .eq("org_id", orgId)
        .order("name", { ascending: true }),
      supabase.from("organizations").select("timezone").eq("id", orgId).single(),
      campaignsQuery,
    ]),
  );

  if (accountsResult.error) {
    throw new Error(`ACCOUNTS_ERROR:${accountsResult.error.message}`);
  }
  if (campaignsResult.error) {
    throw new Error(`CAMPAIGNS_ERROR:${campaignsResult.error.message}`);
  }

  const accounts = (accountsResult.data ?? []) as AccountRow[];
  const campaigns = (campaignsResult.data ?? []) as CampaignRow[];
  const organizationTimezone = (orgResult.data?.timezone as string | null) ?? null;
  const timezone =
    organizationTimezone ??
    accounts.find((account) => Boolean(account.timezone))?.timezone ??
    "UTC";

  const today = todayInTimezone(timezone);
  const from = isValidDate(inputFilters.from) ? inputFilters.from : subDays(today, 29);
  const to = isValidDate(inputFilters.to) ? inputFilters.to : today;

  return {
    orgId,
    accounts,
    campaigns,
    timezone,
    range: { from, to },
    filters: { adAccountId, campaignStatuses, campaignObjectives },
    filterOptions: {
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name ?? account.external_id,
        externalId: account.external_id,
        timezone: account.timezone,
        lastSyncedAt: null,
      })),
      statuses: uniqueSorted(campaigns.map((c) => c.status), (s) => s.toUpperCase()),
      objectives: uniqueSorted(campaigns.map((c) => c.objective)),
    },
    userProfile: { name: profile.name },
  };
});

/**
 * O que o cabeçalho e os filtros precisam (contas, período, fuso),
 * sem esperar as métricas. Resolve antes de getDashboardData.
 */
export function getDashboardContext(filters: DashboardFilters = {}): Promise<DashboardContext> {
  return loadDashboardContext(filtersKey(filters));
}

async function fetchRollup(
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

function buildKpis(totals: Totals): DashboardKpis {
  const grossProfit = totals.revenue - totals.spend;
  return {
    adSpend: totals.spend,
    revenueAttributed: totals.revenue,
    attributedConversions: totals.conversions,
    impressions: totals.impressions,
    clicks: totals.clicks,
    grossProfit,
    // Taxas recalculadas a partir dos totais, nunca pela média das linhas.
    roas: safeDivide(totals.revenue, totals.spend),
    cpa: safeDivide(totals.spend, totals.conversions),
    roi: safeDivide(grossProfit, totals.spend),
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    isDataReal: totals.revenue > 0,
  };
}

const loadDashboardData = cache(async (key: string): Promise<DashboardData> => {
  const [context, supabase] = await Promise.all([
    loadDashboardContext(key),
    getServerSupabase(),
  ]);

  const rollup: Rollup =
    context.campaigns.length > 0
      ? await fetchRollup(supabase, context)
      : { byCampaign: new Map(), byDay: new Map() };

  const accountById = new Map(context.accounts.map((account) => [account.id, account]));
  const overall = emptyTotals();

  const campaignsOutput: DashboardCampaignRow[] = context.campaigns
    .map((campaign) => {
      const account = accountById.get(campaign.ad_account_id);
      const totals = rollup.byCampaign.get(campaign.id) ?? emptyTotals();
      addTotals(overall, totals);
      const kpis = buildKpis(totals);

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        accountId: campaign.ad_account_id,
        accountName: account?.name ?? account?.external_id ?? "Conta sem nome",
        status: campaign.status ?? "UNKNOWN",
        objective: campaign.objective ?? undefined,
        ...totals,
        roas: kpis.roas,
        cpa: kpis.cpa,
        grossProfit: kpis.grossProfit,
        roi: kpis.roi,
        cpm: kpis.cpm,
        ctr: kpis.ctr,
        cpc: kpis.cpc,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const chart: DashboardChartPoint[] = Array.from(rollup.byDay.entries())
    .map(([date, totals]) => ({
      date,
      spend: totals.spend,
      revenue: totals.revenue,
      profit: totals.revenue - totals.spend,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    timezone: context.timezone,
    range: context.range,
    filters: context.filters,
    filterOptions: context.filterOptions,
    kpis: buildKpis(overall),
    chart,
    campaigns: campaignsOutput,
    metrics: {
      activeCampaigns: context.campaigns.filter(
        (campaign) => (campaign.status ?? "").toUpperCase() === "ACTIVE",
      ).length,
      totalCampaigns: context.campaigns.length,
    },
    userProfile: context.userProfile,
    // last_synced_at ainda não é lido aqui.
    lastSyncedAt: null,
    generatedAt: new Date().toISOString(),
  };
});

export function getDashboardData(inputFilters: DashboardFilters = {}): Promise<DashboardData> {
  return loadDashboardData(filtersKey(inputFilters));
}
