// Histórico das decisões das regras automáticas (simuladas, executadas e falhas), mais recentes primeiro.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LIMIT = 100;

export async function GET() {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const db = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await db
    .from("automation_runs")
    .select("id, rule_id, entity_external_id, entity_name, action, mode, status, before_value, after_value, detail, created_at, automation_rules(name)")
    .eq("org_id", session.orgId)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    console.error("[automation/runs]", error.message);
    return NextResponse.json({ error: "Erro ao carregar o histórico" }, { status: 500 });
  }
  return NextResponse.json({ runs: data ?? [] });
}
