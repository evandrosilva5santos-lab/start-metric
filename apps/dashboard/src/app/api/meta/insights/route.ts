import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

function isValidParam(value: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(value);
}

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const accountIdParam = searchParams.get("account_id")?.trim();
  const datePresetParam = searchParams.get("date_preset")?.trim() ?? DEFAULT_DATE_PRESET;

  if (!accountIdParam) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  if (!isValidParam(accountIdParam) || !isValidParam(datePresetParam)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const normalized = normalizeAccountId(accountIdParam);

  // Prioriza UUID interno; fallback para external_id (act_123).
  let accountQuery = await supabase
    .from("ad_accounts")
    .select("id, external_id")
    .eq("platform", "meta")
    .eq("id", normalized.raw)
    .maybeSingle();

  if (!accountQuery.data) {
    accountQuery = await supabase
      .from("ad_accounts")
      .select("id, external_id")
      .eq("platform", "meta")
      .eq("external_id", normalized.withPrefix)
      .maybeSingle();
  }

  if (accountQuery.error) {
    return NextResponse.json({ error: accountQuery.error.message }, { status: 500 });
  }

  const account = accountQuery.data;
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada ou sem permissão" }, { status: 404 });
  }

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id")
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

  return NextResponse.json(Array.from(byDate.values()));
}
