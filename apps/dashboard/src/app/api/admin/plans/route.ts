import { NextResponse } from "next/server";
import { requireAdminOrgContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrimmedString, normalizePlanCode, numberOrNull, optionalTrimmedString, readBodyObject } from "@/lib/admin/validation";
import type { AdminPlan } from "@/lib/admin/types";

type PlanCountRow = {
  plan_id: string;
};

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    return auth.error;
  }

  const adminClient = createAdminClient();

  const [plansResult, subscriptionsResult] = await Promise.all([
    adminClient
      .from("admin_plans")
      .select("id, code, name, status, description, price_monthly_mock, price_yearly_mock, is_mock, created_at, updated_at")
      .eq("org_id", auth.context.orgId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("admin_user_subscriptions")
      .select("plan_id")
      .eq("org_id", auth.context.orgId),
  ]);

  if (plansResult.error) {
    return NextResponse.json({ error: plansResult.error.message }, { status: 500 });
  }

  if (subscriptionsResult.error) {
    return NextResponse.json({ error: subscriptionsResult.error.message }, { status: 500 });
  }

  const countMap = new Map<string, number>();
  for (const row of (subscriptionsResult.data ?? []) as PlanCountRow[]) {
    const current = countMap.get(row.plan_id) ?? 0;
    countMap.set(row.plan_id, current + 1);
  }

  const plans = ((plansResult.data ?? []) as AdminPlan[]).map((plan) => ({
    ...plan,
    subscription_count: countMap.get(plan.id) ?? 0,
  }));

  return NextResponse.json({ plans });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    return auth.error;
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const body = readBodyObject(bodyRaw);
  if (!body) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const name = getTrimmedString(body.name);
  const codeInput = getTrimmedString(body.code);
  const description = optionalTrimmedString(body.description);
  const priceMonthly = numberOrNull(body.priceMonthlyMock);
  const priceYearly = numberOrNull(body.priceYearlyMock);
  const statusRaw = getTrimmedString(body.status) || "draft";

  if (!name) {
    return NextResponse.json({ error: "Nome do plano é obrigatório" }, { status: 422 });
  }

  const status = (["draft", "active", "archived"] as const).includes(
    statusRaw as "draft" | "active" | "archived",
  )
    ? (statusRaw as "draft" | "active" | "archived")
    : "draft";

  const code = normalizePlanCode(codeInput, name);
  if (!code) {
    return NextResponse.json({ error: "Código do plano inválido" }, { status: 422 });
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("admin_plans")
    .insert({
      org_id: auth.context.orgId,
      code,
      name,
      status,
      description,
      price_monthly_mock: priceMonthly,
      price_yearly_mock: priceYearly,
      is_mock: true,
      created_by: auth.context.userId,
    })
    .select("id, code, name, status, description, price_monthly_mock, price_yearly_mock, is_mock, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já existe um plano com este código" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plan: data }, { status: 201 });
}
