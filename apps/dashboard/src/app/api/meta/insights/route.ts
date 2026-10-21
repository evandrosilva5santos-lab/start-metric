import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import {
  OperationalAccountError,
  resolveOperationalAccount,
} from "@/lib/accounts/operational";

const DEFAULT_DATE_PRESET = "last_30d";

type InsightsRow = {
  date: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
};

type DailyInsightResponse = {
  account_id: string;
  date: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
};

function parsePresetToDays(datePreset: string): number {
  if (datePreset === "last_7d") return 7;
  if (datePreset === "last_14d") return 14;
  if (datePreset === "last_90d") return 90;
  return 30;
}

function normalizeAccountId(rawAccountId: string): { raw: string; withPrefix: string } {
  const normalized = rawAccountId.trim();
  if (normalized.startsWith("act_")) {
    return { raw: normalized, withPrefix: normalized };
  }
  return { raw: normalized, withPrefix: `act_${normalized}` };
}

function toNumber(value: number | null | undefined): number {
  if (typeof value !== "number") return 0;
  return Number.isFinite(value) ? value : 0;
}

function cutoffDate(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString().slice(0, 10);
}

const INSIGHTS_CACHE_TTL_MS = 60 * 1000;
const insightsMemoryCache = new Map<string, { timestamp: number; data: DailyInsightResponse[] }>();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const supabase = session.supabase;

  const searchParams = request.nextUrl.searchParams;
  const accountIdParam = searchParams.get("account_id")?.trim();
  const datePresetParam = searchParams.get("date_preset")?.trim() ?? DEFAULT_DATE_PRESET;

  if (!accountIdParam) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  if (!/^(?:act_)?[0-9]+$/.test(accountIdParam) && !z.string().uuid().safeParse(accountIdParam).success) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }
  if (!/^[a-z0-9_]+$/.test(datePresetParam)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const normalized = normalizeAccountId(accountIdParam);
  let account;
  try {
    const isInternalId = z.string().uuid().safeParse(normalized.raw).success;
    account = await resolveOperationalAccount(session.supabase, {
      orgId: session.orgId,
      accountId: isInternalId ? normalized.raw : undefined,
      externalId: isInternalId ? undefined : normalized.withPrefix,
      platform: "meta",
    });
  } catch (error) {
    if (error instanceof OperationalAccountError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[meta/insights] Falha ao autorizar conta:", error);
    return NextResponse.json({ error: "Falha ao autorizar a conta." }, { status: 500 });
  }

  const cacheKey = `${session.orgId}:${account.client_id}:${account.id}:${datePresetParam}`;
  const now = Date.now();
  const cached = insightsMemoryCache.get(cacheKey);
  if (cached && now - cached.timestamp < INSIGHTS_CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("org_id", session.orgId)
    .eq("ad_account_id", account.id);

  if (campaignsError) {
    return NextResponse.json({ error: campaignsError.message }, { status: 500 });
  }

  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
  if (campaignIds.length === 0) {
    return NextResponse.json([]);
  }

  const startDate = cutoffDate(parsePresetToDays(datePresetParam));
  const { data: metrics, error: metricsError } = await supabase
    .from("daily_metrics")
    .select("date, spend, impressions, clicks")
    .eq("org_id", session.orgId)
    .in("campaign_id", campaignIds)
    .gte("date", startDate)
    .order("date", { ascending: true });

  if (metricsError) {
    return NextResponse.json({ error: metricsError.message }, { status: 500 });
  }

  const byDate = new Map<string, DailyInsightResponse>();
  for (const row of (metrics ?? []) as InsightsRow[]) {
    const current = byDate.get(row.date) ?? {
      account_id: account.external_id,
      date: row.date,
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
    };

    current.total_spend += toNumber(row.spend);
    current.total_impressions += toNumber(row.impressions);
    current.total_clicks += toNumber(row.clicks);
    byDate.set(row.date, current);
  }

  const result = Array.from(byDate.values());
  if (insightsMemoryCache.size >= 100) {
    const oldest = insightsMemoryCache.keys().next().value;
    if (oldest !== undefined) insightsMemoryCache.delete(oldest);
  }
  insightsMemoryCache.set(cacheKey, { timestamp: now, data: result });

  return NextResponse.json(result);
}
