// Regras automáticas da organização: listar e criar (toda regra nova nasce simulando).

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ruleCreateSchema } from "@/lib/automation/schema";

export const dynamic = "force-dynamic";

const RULE_COLUMNS =
  "id, client_id, ad_account_id, name, platform, entity_external_id, entity_name, metric, operator, value, period, min_spend, action, action_percent, mode, is_active, cooldown_hours, max_actions_per_day, last_evaluated_at, last_triggered_at, created_at";

export async function GET() {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const db = createAdminClient() as unknown as SupabaseClient;
  const [rules, accounts, clients] = await Promise.all([
    db.from("automation_rules").select(RULE_COLUMNS).eq("org_id", session.orgId).order("created_at", { ascending: false }),
    db
      .from("ad_accounts")
      .select("id, name, external_id, platform, client_id, status")
      .eq("org_id", session.orgId)
      .eq("status", "active")
      .not("client_id", "is", null),
    db.from("clients").select("id, name").eq("org_id", session.orgId).is("archived_at", null).order("name"),
  ]);
  if (rules.error || accounts.error || clients.error) {
    console.error("[automation/rules] listar:", rules.error?.message ?? accounts.error?.message ?? clients.error?.message);
    return NextResponse.json({ error: "Erro ao carregar as regras" }, { status: 500 });
  }
  return NextResponse.json({ rules: rules.data ?? [], accounts: accounts.data ?? [], clients: clients.data ?? [] });
}

export async function POST(request: Request) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = ruleCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const input = parsed.data;

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: account } = await db
    .from("ad_accounts")
    .select("id, platform, client_id, status")
    .eq("org_id", session.orgId)
    .eq("id", input.adAccountId)
    .maybeSingle();
  if (!account || (account.platform !== "meta" && account.platform !== "google")) {
    return NextResponse.json({ error: "Conta de anúncio não encontrada" }, { status: 404 });
  }

  const { data, error } = await db
    .from("automation_rules")
    .insert({
      org_id: session.orgId,
      client_id: account.client_id,
      ad_account_id: account.id,
      name: input.name,
      platform: account.platform,
      entity_external_id: input.entityExternalId,
      entity_name: input.entityName,
      metric: input.metric,
      operator: input.operator,
      value: input.value,
      period: input.period,
      min_spend: input.minSpend,
      action: input.action,
      action_percent: input.actionPercent,
      cooldown_hours: input.cooldownHours,
      max_actions_per_day: input.maxActionsPerDay,
      mode: "simulate",
      created_by: session.user.id,
    })
    .select(RULE_COLUMNS)
    .single();
  if (error) {
    console.error("[automation/rules] criar:", error.message);
    return NextResponse.json({ error: "Não foi possível salvar a regra" }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
