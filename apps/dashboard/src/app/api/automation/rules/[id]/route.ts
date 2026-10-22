// Editar (inclusive ligar/desligar e trocar simular ↔ executar) ou apagar uma regra automática.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ruleUpdateSchema } from "@/lib/automation/schema";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const COLUMN: Record<string, string> = {
  name: "name",
  metric: "metric",
  operator: "operator",
  value: "value",
  period: "period",
  minSpend: "min_spend",
  action: "action",
  actionPercent: "action_percent",
  cooldownHours: "cooldown_hours",
  maxActionsPerDay: "max_actions_per_day",
  isActive: "is_active",
  mode: "mode",
};

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = ruleUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (COLUMN[key] && value !== undefined) update[COLUMN[key]] = value;
  }

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await db.from("automation_rules").update(update).eq("org_id", session.orgId).eq("id", id).select("id").maybeSingle();
  if (error?.code === "23514") return NextResponse.json({ error: "Ajuste de orçamento precisa de porcentagem" }, { status: 400 });
  if (error) {
    console.error("[automation/rules] editar:", error.message);
    return NextResponse.json({ error: "Não foi possível salvar a regra" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const db = createAdminClient() as unknown as SupabaseClient;
  const { data, error } = await db.from("automation_rules").delete().eq("org_id", session.orgId).eq("id", id).select("id");
  if (error) {
    console.error("[automation/rules] apagar:", error.message);
    return NextResponse.json({ error: "Não foi possível apagar a regra" }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
