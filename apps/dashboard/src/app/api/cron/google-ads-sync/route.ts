// Sincroniza campanhas e métricas diárias do Google Ads de todas as orgs conectadas.
// Chamado pelo pg_cron; cada org começa pelas contas sincronizadas há mais tempo.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGoogleOrg, type GoogleSyncSummary } from "@/lib/google-ads/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUDGET_MS = 45_000;

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data, error } = await db.from("google_ads_connections" as never).select("org_id");
  if (error) {
    console.error("[cron/google-ads-sync] Erro ao buscar conexões:", error.message);
    return NextResponse.json({ error: "Erro ao buscar conexões" }, { status: 500 });
  }

  const startedAt = Date.now();
  const orgIds = [...new Set(((data ?? []) as Array<{ org_id: string }>).map((r) => r.org_id))];
  const results: Array<{ orgId: string; summary?: GoogleSyncSummary; error?: string }> = [];
  for (const orgId of orgIds) {
    const remaining = BUDGET_MS - (Date.now() - startedAt);
    if (remaining <= 0) break;
    try {
      results.push({ orgId, summary: await syncGoogleOrg(db as never, orgId, { budgetMs: remaining }) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/google-ads-sync] org ${orgId}:`, message);
      results.push({ orgId, error: message });
    }
  }
  return NextResponse.json({ orgs: orgIds.length, processed: results.length, results });
}
