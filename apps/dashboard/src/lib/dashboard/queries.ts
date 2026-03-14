import "server-only";

import { createClient } from "@/lib/supabase/server";
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

function resolveStatusFilter(value: string | undefined): string {
  if (!value || value === "all") return "all";
  return value.toUpperCase();
}

export async function getDashboardData(inputFilters: DashboardFilters = {}): Promise<DashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("UNAUTHORIZED");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.org_id) {
    throw new Error("ORG_NOT_FOUND");
  }

  const orgId = profile.org_id as string;

  const { data: accountsData, error: accountsError } = await supabase
    .from("ad_accounts")
    .select("id, name, external_id, timezone")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (accountsError) {
    throw new Error(`ACCOUNTS_ERROR:${accountsError.message}`);
  }

  const accounts = (accountsData ?? []) as AccountRow[];

  const { data: orgData } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", orgId)
    .single();

  const organizationTimezone = (orgData?.timezone as string | null) ?? null;
  const timezone =
    organizationTimezone ??
    accounts.find((account) => Boolean(account.timezone))?.timezone ??
    "UTC";

  const today = todayInTimezone(timezone);
  const defaultFrom = subDays(today, 29);
  const defaultTo = today;

  const from = isValidDate(inputFilters.from) ? inputFilters.from : defaultFrom;
  const to = isValidDate(inputFilters.to) ? inputFilters.to : defaultTo;
  const adAccountId = inputFilters.adAccountId ?? "all";
  const campaignStatus = resolveStatusFilter(inputFilters.campaignStatus);

  let campaignsQuery = supabase
    .from("campaigns")
    .select("id, name, status, ad_account_id")
    .eq("org_id", orgId);

  if (adAccountId !== "all") {
    campaignsQuery = campaignsQuery.eq("ad_account_id", adAccountId);
  }

  if (campaignStatus !== "all") {
    campaignsQuery = campaignsQuery.eq("status", campaignStatus);
  }

  const { data: campaignsData, error: campaignsError } = await campaignsQuery;
  if (campaignsError) {
    throw new Error(`CAMPAIGNS_ERROR:${campaignsError.message}`);
  }

  const campaigns = (campaignsData ?? []) as CampaignRow[];
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const statuses = Array.from(
    new Set(
      (campaignsData ?? [])
        .map((campaign) => campaign.status)
        .filter((status): status is string => Boolean(status))
        .map((status) => status.toUpperCase()),
    ),
  ).sort();

  if (campaignIds.length === 0) {
    return {
      timezone,
      range: { from, to },
      filters: {
        adAccountId,
        campaignStatus,
      },
      filterOptions: {
        accounts: accounts.map((account) => ({
          id: account.id,
          name: account.name ?? account.external_id,
          externalId: account.external_id,
          timezone: account.timezone,
        })),
        statuses,
      },
      kpis: {
        adSpend: 0,
        revenueAttributed: 0,
        attributedConversions: 0,
        impressions: 0,
        clicks: 0,
        grossProfit: 0,
        roas: 0,
        cpa: 0,
        roi: 0,
      },
      chart: [],
      campaigns: [],
      metrics: {
        activeCampaigns: 0,
        totalCampaigns: 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  const { data: metricsData, error: metricsError } = await supabase
    .from("daily_metrics")
    .select("date, campaign_id, spend, revenue_attributed, conversions, impressions, clicks")
    .eq("org_id", orgId)
    .in("campaign_id", campaignIds)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (metricsError) {
    throw new Error(`METRICS_ERROR:${metricsError.message}`);
  }

  const metrics = (metricsData ?? []) as MetricRow[];
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

  const kpisAccumulator = {
    adSpend: 0,
    revenueAttributed: 0,
    attributedConversions: 0,
    impressions: 0,
    clicks: 0,
  };

  const chartMap = new Map<string, DashboardChartPoint>();
  const campaignAcc = new Map<string, Omit<DashboardCampaignRow, "roas" | "cpa" | "grossProfit" | "roi">>();

  for (const metric of metrics) {
    const campaign = campaignById.get(metric.campaign_id);
    if (!campaign) continue;

    const account = accountById.get(campaign.ad_account_id);
    const spend = toNumber(metric.spend);
    const revenue = toNumber(metric.revenue_attributed);
    const conversions = toNumber(metric.conversions);
    const impressions = toNumber(metric.impressions);
    const clicks = toNumber(metric.clicks);

    kpisAccumulator.adSpend += spend;
    kpisAccumulator.revenueAttributed += revenue;
    kpisAccumulator.attributedConversions += conversions;
    kpisAccumulator.impressions += impressions;
    kpisAccumulator.clicks += clicks;

    const chartEntry = chartMap.get(metric.date) ?? {
      date: metric.date,
      spend: 0,
      revenue: 0,
      profit: 0,
    };
    chartEntry.spend += spend;
    chartEntry.revenue += revenue;
    chartEntry.profit = chartEntry.revenue - chartEntry.spend;
    chartMap.set(metric.date, chartEntry);

    const row =
      campaignAcc.get(metric.campaign_id) ?? {
        campaignId: campaign.id,
        campaignName: campaign.name,
        accountId: campaign.ad_account_id,
        accountName: account?.name ?? account?.external_id ?? "Conta sem nome",
        status: campaign.status ?? "UNKNOWN",
        spend: 0,
        revenue: 0,
        conversions: 0,
        impressions: 0,
        clicks: 0,
      };

    row.spend += spend;
    row.revenue += revenue;
    row.conversions += conversions;
    row.impressions += impressions;
    row.clicks += clicks;
    campaignAcc.set(metric.campaign_id, row);
  }

  const grossProfit = kpisAccumulator.revenueAttributed - kpisAccumulator.adSpend;
  const kpis: DashboardKpis = {
    ...kpisAccumulator,
    grossProfit,
    roas: safeDivide(kpisAccumulator.revenueAttributed, kpisAccumulator.adSpend),
    cpa: safeDivide(kpisAccumulator.adSpend, kpisAccumulator.attributedConversions),
    roi: safeDivide(grossProfit, kpisAccumulator.adSpend),
  };

  const campaignsOutput: DashboardCampaignRow[] = campaigns
    .map((campaign) => {
      const account = accountById.get(campaign.ad_account_id);
      const row =
        campaignAcc.get(campaign.id) ?? {
          campaignId: campaign.id,
          campaignName: campaign.name,
          accountId: campaign.ad_account_id,
          accountName: account?.name ?? account?.external_id ?? "Conta sem nome",
          status: campaign.status ?? "UNKNOWN",
          spend: 0,
          revenue: 0,
          conversions: 0,
          impressions: 0,
          clicks: 0,
        };
      const rowGrossProfit = row.revenue - row.spend;
      return {
        ...row,
        roas: safeDivide(row.revenue, row.spend),
        cpa: safeDivide(row.spend, row.conversions),
        grossProfit: rowGrossProfit,
        roi: safeDivide(rowGrossProfit, row.spend),
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const chart = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    timezone,
    range: { from, to },
    filters: {
      adAccountId,
      campaignStatus,
    },
    filterOptions: {
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name ?? account.external_id,
        externalId: account.external_id,
        timezone: account.timezone,
      })),
      statuses,
    },
    kpis,
    chart,
    campaigns: campaignsOutput,
    metrics: {
      activeCampaigns: campaigns.filter((campaign) => (campaign.status ?? "").toUpperCase() === "ACTIVE").length,
      totalCampaigns: campaigns.length,
    },
    generatedAt: new Date().toISOString(),
  };
}
