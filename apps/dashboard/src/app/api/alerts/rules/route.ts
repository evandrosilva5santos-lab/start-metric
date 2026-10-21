import { NextResponse } from "next/server";
import { createRule, RULE_COLUMNS } from "@/lib/alerts/rules-store";
import { firstIssue, ruleCreateSchema } from "@/lib/alerts/schemas";
import { jsonError, readJson, requireAlertsAuth } from "@/lib/alerts/server";

export async function GET(): Promise<NextResponse> {
  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from("notification_rules")
    .select(RULE_COLUMNS)
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false });

  if (error) return jsonError("Não deu para carregar as regras.", 500);
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  const json = await readJson(request);
  if (!json.ok) return jsonError("Payload inválido", 400);
  const parsed = ruleCreateSchema.safeParse(json.body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const outcome = await createRule(auth, parsed.data);
  if (!outcome.ok) return jsonError(outcome.error, outcome.status);
  return NextResponse.json(outcome.rule, { status: 201 });
}
