import "server-only";

import { cache } from "react";
import {
  getDashboardSession,
  getServerSupabase,
  getSessionProfile,
  getSessionUser,
} from "@/lib/auth/session";
import { listOperationalAccounts } from "@/lib/accounts/operational";
import { resolvePreset } from "./overview-range";
import { addTotals, emptyTotals, fetchRollup, timed, type Rollup, type Totals } from "./rollup";
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

type AccountRow = {
  id: string;
  name: string | null;
  external_id: string;
  timezone: string | null;
  client_id: string | null;
};

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
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

type SupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

export type DashboardContext = Pick<
  DashboardData,
  "timezone" | "range" | "filters" | "filterOptions" | "userProfile"
> & {
  orgId: string;
  accounts: AccountRow[];
  campaigns: CampaignRow[];
};

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
    rangePreset: filters.rangePreset ?? null,
    clientId: filters.clientId ?? null,
    accountExternalId: filters.accountExternalId ?? null,
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
    rangePreset: (parsed.rangePreset as string | null) ?? undefined,
    clientId: (parsed.clientId as string | null) ?? undefined,
    accountExternalId: (parsed.accountExternalId as string | null) ?? undefined,
    adAccountId: (parsed.adAccountId as string | null) ?? undefined,
    campaignStatuses: parsed.campaignStatuses as string[],
    campaignObjectives: parsed.campaignObjectives as string[],
  };
}

type DashboardAccess = {
  supabase: SupabaseClient;
  orgId: string;
  name: string | null;
};

// Quem entra pela senha do painel não tem usuário no Supabase: usa a
// organização e o cliente resolvidos por getDashboardSession.
export const resolveDashboardAccess = cache(async (): Promise<DashboardAccess> => {
  const [user, profile, supabase] = await Promise.all([
    getSessionUser(),
    timed("profile", () => getSessionProfile()),
    getServerSupabase(),
  ]);

  if (user) {
    if (!profile?.orgId) throw new Error("ORG_NOT_FOUND");
    return { supabase, orgId: profile.orgId, name: profile.name };
  }

  const session = await getDashboardSession();
  if (session.isAuthorized && session.isPainel && session.orgId && session.supabase) {
    return { supabase: session.supabase as SupabaseClient, orgId: session.orgId, name: null };
  }
  throw new Error("UNAUTHORIZED");
});

const loadDashboardContext = cache(async (key: string): Promise<DashboardContext> => {
  const inputFilters = parseFiltersKey(key);
  const { supabase, orgId, name } = await resolveDashboardAccess();
  const requestedAdAccountId = inputFilters.adAccountId ?? "all";
  const campaignStatuses = resolveStatusFilter(inputFilters.campaignStatuses);
  const campaignObjectives = inputFilters.campaignObjectives ?? [];

  const [inventory, orgResult] = await timed("authorized-accounts+org", () =>
    Promise.all([
      listOperationalAccounts(supabase, orgId),
      supabase.from("organizations").select("timezone").eq("id", orgId).single(),
    ]),
  );
  const allAccounts = inventory.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    external_id: account.external_id,
    timezone: account.timezone,
    client_id: account.client_id,
  })) as AccountRow[];
  const clientId = allAccounts.some((account) => account.client_id === inputFilters.clientId)
    ? inputFilters.clientId
    : undefined;
  const accounts = clientId ? allAccounts.filter((account) => account.client_id === clientId) : allAccounts;
  const authorizedAccountIds = accounts.map((account) => account.id);
  const byExternalId = accounts.find((account) => account.external_id === inputFilters.accountExternalId);
  const requestedId = byExternalId?.id ?? requestedAdAccountId;
  const adAccountId =
    requestedId === "all" || authorizedAccountIds.includes(requestedId) ? requestedId : "all";

  let campaignsQuery = supabase
    .from("campaigns")
    .select("id, name, status, objective, ad_account_id")
    .eq("org_id", orgId);

  if (adAccountId !== "all") {
    campaignsQuery = campaignsQuery.eq("ad_account_id", adAccountId);
  } else if (authorizedAccountIds.length > 0) {
    campaignsQuery = campaignsQuery.in("ad_account_id", authorizedAccountIds);
  }
  if (campaignStatuses.length > 0) {
    campaignsQuery = campaignsQuery.in("status", campaignStatuses);
  }
  if (campaignObjectives.length > 0) {
    campaignsQuery = campaignsQuery.in("objective", campaignObjectives);
  }

  const campaignsResult =
    authorizedAccountIds.length === 0
      ? { data: [] as CampaignRow[], error: null }
      : await timed("authorized-campaigns", () => campaignsQuery);
  if (campaignsResult.error) {
    throw new Error(`CAMPAIGNS_ERROR:${campaignsResult.error.message}`);
  }

  const campaigns = (campaignsResult.data ?? []) as CampaignRow[];
  const organizationTimezone = (orgResult.data?.timezone as string | null) ?? null;
  const timezone =
    organizationTimezone ??
    accounts.find((account) => Boolean(account.timezone))?.timezone ??
    "UTC";

  const today = todayInTimezone(timezone);
  const preset = inputFilters.rangePreset ? resolvePreset(inputFilters.rangePreset, today) : null;
  const from = isValidDate(inputFilters.from) ? inputFilters.from : (preset?.from ?? subDays(today, 29));
  const to = isValidDate(inputFilters.to) ? inputFilters.to : (preset?.to ?? today);

  return {
    orgId,
    accounts,
    campaigns,
    timezone,
    range: { from, to },
    filters: { clientId, adAccountId, campaignStatuses, campaignObjectives },
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
    userProfile: { name },
  };
});

/**
 * O que o cabeçalho e os filtros precisam (contas, período, fuso),
 * sem esperar as métricas. Resolve antes de getDashboardData.
 */
export function getDashboardContext(filters: DashboardFilters = {}): Promise<DashboardContext> {
  return loadDashboardContext(filtersKey(filters));
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
  const [context, { supabase }] = await Promise.all([
    loadDashboardContext(key),
    resolveDashboardAccess(),
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
      conversions: totals.conversions,
      impressions: totals.impressions,
      clicks: totals.clicks,
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
