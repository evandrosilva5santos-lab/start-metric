// Sincroniza o histórico de alterações (act_{id}/activities) das contas Meta ativas em lotes.
// Chamado de hora em hora (minuto :07) pelo pg_cron; prioriza as contas sincronizadas há mais tempo.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAccountsHistory, type ActivityAccount } from "@/lib/activity/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUDGET_MS = 45_000;
const MAX_DAYS_PER_ACCOUNT = 4;

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
  const { data: accounts, error } = await db
    .from("ad_accounts")
    .select("id, org_id, external_id, token_encrypted, timezone")
    .eq("platform", "meta")
    .eq("status", "active");
  if (error) {
    console.error("[cron/meta-activities] Erro ao buscar contas:", error.message);
    return NextResponse.json({ error: "Erro ao buscar contas" }, { status: 500 });
  }

  const { data: runs } = await db
    .from("activity_sync_runs" as never)
    .select("ad_account_id, started_at")
    .order("started_at", { ascending: false })
    .limit(2000);
  const lastRun = new Map<string, string>();
  for (const run of (runs ?? []) as Array<{ ad_account_id: string; started_at: string }>) {
    if (!lastRun.has(run.ad_account_id)) lastRun.set(run.ad_account_id, run.started_at);
  }
  const queue = ((accounts ?? []) as ActivityAccount[]).sort(
    (a, b) => (lastRun.get(a.id) ?? "").localeCompare(lastRun.get(b.id) ?? ""),
  );

  const outcomes = await syncAccountsHistory(db as never, queue, { trigger: "cron", budgetMs: BUDGET_MS, maxDays: MAX_DAYS_PER_ACCOUNT });
  const summary = {
    accounts: queue.length,
    processed: outcomes.length,
    inserted: outcomes.reduce((sum, o) => sum + ("result" in o ? o.result.inserted : 0), 0),
    failed: outcomes.filter((o) => "result" in o && o.result.status === "failed").length,
  };
  console.log(`[cron/meta-activities] ${JSON.stringify(summary)}`);
  return NextResponse.json(summary);
}
