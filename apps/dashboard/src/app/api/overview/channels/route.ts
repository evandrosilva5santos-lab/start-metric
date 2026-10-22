// Visão geral "Meta + Google": números de cada canal e do total para um cliente no período.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { listOperationalAccounts } from "@/lib/accounts/operational";
import { buildChannelOverview, type DatedGoogleRow, type DatedMetaRow } from "@/lib/dashboard/channels";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_PAGES = 30;
const MAX_SPAN_DAYS = 366;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({ clientId: z.string().uuid(), from: day, to: day });

type Db = SupabaseClient;

async function paged<T>(load: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await load(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
  throw new Error("Período com dados demais; reduza o intervalo.");
}

export async function GET(request: NextRequest) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  const { clientId, from, to } = parsed.data;
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!(span >= 0 && span < MAX_SPAN_DAYS)) return NextResponse.json({ error: "Período inválido" }, { status: 400 });

  try {
    const inventory = await listOperationalAccounts(session.supabase, session.orgId);
    const accounts = inventory.accounts.filter((a) => a.client_id === clientId);
    const metaIds = accounts.filter((a) => a.platform === "meta").map((a) => a.id);
    const googleIds = accounts.filter((a) => a.platform === "google").map((a) => a.id);
    const db = session.supabase as unknown as Db;

    const [metaRows, googleRows] = await Promise.all([
      metaIds.length === 0
        ? []
        : paged<DatedMetaRow>((a, b) =>
            db
              .from("daily_metrics")
              .select("id, date, spend, impressions, clicks, conversions, revenue_attributed, campaigns!inner(ad_account_id)")
              .eq("org_id", session.orgId)
              .in("campaigns.ad_account_id", metaIds)
              .gte("date", from)
              .lte("date", to)
              .order("id")
              .range(a, b),
          ),
      googleIds.length === 0
        ? []
        : paged<DatedGoogleRow>((a, b) =>
            db
              .from("google_ads_daily_metrics")
              .select("ad_account_id, campaign_id, date, cost_micros, impressions, clicks, conversions, conversions_value")
              .eq("org_id", session.orgId)
              .in("ad_account_id", googleIds)
              .gte("date", from)
              .lte("date", to)
              .order("date")
              .order("campaign_id")
              .range(a, b),
          ),
    ]);

    const client = inventory.clients.find((c) => c.id === clientId);
    return NextResponse.json({
      client: client ? { id: client.id, name: client.name } : null,
      from,
      to,
      accounts: { meta: metaIds.length, google: googleIds.length },
      ...buildChannelOverview(metaRows, googleRows, from, to),
    });
  } catch (err) {
    console.error("[overview/channels]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao montar o comparativo" }, { status: 500 });
  }
}
