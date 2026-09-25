import type { SupabaseClient } from "@supabase/supabase-js";

export interface RenderResult {
  rendered: string;
  warnings: string[];
}

export interface TemplateVariables {
  client_name: string;
  period: string;
  total_spend: string;
  total_revenue: string;
  roas: string;
  cpa: string;
  roi: string;
  gross_profit: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
  conversions: string;
  best_campaign: string;
  worst_campaign: string;
}

export function renderTemplate(
  template: string,
  variables: Partial<TemplateVariables>,
): RenderResult {
  const warnings: string[] = [];

  const rendered = template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim();

    if (trimmed in variables && variables[trimmed as keyof TemplateVariables] !== undefined) {
      return String(variables[trimmed as keyof TemplateVariables]);
    }

    warnings.push(trimmed);
    return match;
  });

  return { rendered, warnings };
}

export function formatVariables(raw: {
  totalSpend?: number;
  totalRevenue?: number;
  roas?: number;
  cpa?: number;
  roi?: number;
  grossProfit?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpm?: number;
  cpc?: number;
  conversions?: number;
}): Pick<
  TemplateVariables,
  | "total_spend"
  | "total_revenue"
  | "roas"
  | "cpa"
  | "roi"
  | "gross_profit"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpm"
  | "cpc"
  | "conversions"
> {
  const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const number = new Intl.NumberFormat("pt-BR");

  return {
    total_spend: currency.format(raw.totalSpend ?? 0),
    total_revenue: currency.format(raw.totalRevenue ?? 0),
    roas: `${(raw.roas ?? 0).toFixed(1)}x`,
    cpa: currency.format(raw.cpa ?? 0),
    roi: `${(raw.roi ?? 0).toFixed(0)}%`,
    gross_profit: currency.format(raw.grossProfit ?? 0),
    impressions: number.format(raw.impressions ?? 0),
    clicks: number.format(raw.clicks ?? 0),
    ctr: `${(raw.ctr ?? 0).toFixed(1)}%`,
    cpm: currency.format(raw.cpm ?? 0),
    cpc: currency.format(raw.cpc ?? 0),
    conversions: number.format(raw.conversions ?? 0),
  };
}

export function formatPeriod(from: string, to: string): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const fromTime = fromDate.getTime();
  const toTime = toDate.getTime();

  if (fromTime === toTime) {
    return formatDate(fromDate);
  }

  return `${formatDate(fromDate)} a ${formatDate(toDate)}`;
}

interface MetricRow {
  spend: number | null;
  revenue_attributed: number | null;
  roas: number | null;
  cpa: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  campaigns: {
    name: string;
    ad_accounts: {
      client_id: string;
    }[];
  }[];
}

interface BuildVariablesOptions {
  orgId: string;
  clientId: string;
  dateRange: { from: string; to: string };
}

export async function buildVariables(
  supabase: SupabaseClient,
  { orgId, clientId, dateRange }: BuildVariablesOptions,
): Promise<Partial<TemplateVariables>> {
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .single();

  const { data: adAccounts } = await supabase
    .from("ad_accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("client_id", clientId);

  const accountIds = adAccounts?.map((a) => a.id) ?? [];

  if (accountIds.length === 0) {
    return {
      client_name: client?.name ?? "Cliente",
      period: formatPeriod(dateRange.from, dateRange.to),
      ...formatVariables({}),
      best_campaign: "—",
      worst_campaign: "—",
    };
  }

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("org_id", orgId)
    .in("ad_account_id", accountIds);

  const campaignIds = campaigns?.map((c) => c.id) ?? [];

  let metrics: MetricRow[] = [];
  if (campaignIds.length > 0) {
    const { data: metricsData } = await supabase
      .from("daily_metrics")
      .select(
        "spend, revenue_attributed, roas, cpa, impressions, clicks, conversions, campaigns!inner(name, ad_accounts!inner(client_id))",
      )
      .eq("org_id", orgId)
      .in("campaign_id", campaignIds)
      .gte("date", dateRange.from)
      .lte("date", dateRange.to);

    metrics = (metricsData ?? []) as unknown as MetricRow[];
  }

  const totals = {
    totalSpend: sum(metrics, "spend"),
    totalRevenue: sum(metrics, "revenue_attributed"),
    roas: weightedAverage(metrics, "revenue_attributed", "roas"),
    cpa: weightedAverage(metrics, "conversions", "cpa"),
    roi: totalsToRoi(sum(metrics, "spend"), sum(metrics, "revenue_attributed")),
    grossProfit: (sum(metrics, "revenue_attributed") ?? 0) - (sum(metrics, "spend") ?? 0),
    impressions: sum(metrics, "impressions"),
    clicks: sum(metrics, "clicks"),
    ctr: calculateCtr(sum(metrics, "clicks"), sum(metrics, "impressions")),
    cpm: calculateCpm(sum(metrics, "spend"), sum(metrics, "impressions")),
    cpc: calculateCpc(sum(metrics, "spend"), sum(metrics, "clicks")),
    conversions: sum(metrics, "conversions"),
  };

  const campaignMap = new Map<string, { roas: number; name: string }>();

  for (const metric of metrics) {
    for (const campaign of metric.campaigns ?? []) {
      const campaignName = campaign.name ?? "Unknown";
      const existing = campaignMap.get(campaignName);

      if (!existing) {
        campaignMap.set(campaignName, {
          roas: metric.roas ?? 0,
          name: campaignName,
        });
        continue;
      }

      const revenue = metric.revenue_attributed ?? 0;
      const existingRevenue = existing.roas * existing.name.length;
      existing.roas = (existing.roas * existingRevenue + (metric.roas ?? 0) * revenue) / (existingRevenue + revenue);
    }
  }

  const sortedCampaigns = Array.from(campaignMap.values()).sort((a, b) => b.roas - a.roas);

  return {
    ...formatVariables(totals),
    client_name: client?.name ?? "Cliente",
    period: formatPeriod(dateRange.from, dateRange.to),
    best_campaign: sortedCampaigns[0]?.name ?? "—",
    worst_campaign: sortedCampaigns[sortedCampaigns.length - 1]?.name ?? "—",
  };
}

function sum(metrics: MetricRow[], key: keyof MetricRow): number {
  return metrics.reduce((acc, m) => acc + ((m[key] as number | null) ?? 0), 0);
}

function weightedAverage(
  metrics: MetricRow[],
  weightKey: keyof MetricRow,
  valueKey: keyof MetricRow,
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const m of metrics) {
    const weight = (m[weightKey] as number | null) ?? 0;
    const value = (m[valueKey] as number | null) ?? 0;

    if (weight > 0) {
      weightedSum += value * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function totalsToRoi(spend: number | null, revenue: number | null): number {
  const s = spend ?? 0;
  const r = revenue ?? 0;
  if (s === 0) return 0;
  return ((r - s) / s) * 100;
}

function calculateCtr(clicks: number | null, impressions: number | null): number {
  const c = clicks ?? 0;
  const i = impressions ?? 0;
  if (i === 0) return 0;
  return (c / i) * 100;
}

function calculateCpm(spend: number | null, impressions: number | null): number {
  const s = spend ?? 0;
  const i = impressions ?? 0;
  if (i === 0) return 0;
  return (s / i) * 1000;
}

function calculateCpc(spend: number | null, clicks: number | null): number {
  const s = spend ?? 0;
  const c = clicks ?? 0;
  if (c === 0) return 0;
  return s / c;
}
