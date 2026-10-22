// Avalia as regras automáticas ativas de todas as orgs (pg_cron, de hora em hora).
// Regras em "simulate" só registram; em "execute" aplicam na Meta/Google.

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateRule, type RuleRow } from "@/lib/automation/server";

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
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await db
    .from("automation_rules")
    .select("*")
    .eq("is_active", true)
    .order("last_evaluated_at", { ascending: true, nullsFirst: true });
  if (error) {
    console.error("[cron/automation] Erro ao buscar regras:", error.message);
    return NextResponse.json({ error: "Erro ao buscar regras" }, { status: 500 });
  }

  const startedAt = Date.now();
  const summary = { rules: (data ?? []).length, evaluated: 0, executed: 0, simulated: 0, failed: 0, errors: [] as string[] };
  for (const rule of (data ?? []) as RuleRow[]) {
    if (Date.now() - startedAt > BUDGET_MS) break;
    try {
      const result = await evaluateRule(db, rule, { now: new Date(), dryRun: false });
      summary.evaluated++;
      summary.executed += result.executed;
      summary.simulated += result.simulated;
      summary.failed += result.failed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron/automation] regra ${rule.id}:`, message);
      summary.errors.push(`${rule.name}: ${message}`.slice(0, 300));
    }
  }
  return NextResponse.json(summary);
}
