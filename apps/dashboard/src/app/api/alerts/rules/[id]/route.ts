import { NextResponse } from "next/server";
import { updateRule } from "@/lib/alerts/rules-store";
import { alertIdSchema, firstIssue, ruleUpdateSchema } from "@/lib/alerts/schemas";
import { jsonError, readJson, requireAlertsAuth } from "@/lib/alerts/server";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  if (!alertIdSchema.safeParse(id).success) return jsonError("Regra inválida.", 400);

  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  const json = await readJson(request);
  if (!json.ok) return jsonError("Payload inválido", 400);
  const parsed = ruleUpdateSchema.safeParse(json.body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const outcome = await updateRule(auth, id, parsed.data);
  if (!outcome.ok) return jsonError(outcome.error, outcome.status);
  return NextResponse.json(outcome.rule);
}

export async function DELETE(_: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  if (!alertIdSchema.safeParse(id).success) return jsonError("Regra inválida.", 400);

  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  const { error } = await auth.supabase.from("notification_rules").delete().eq("id", id).eq("org_id", auth.orgId);
  if (error) return jsonError("Não deu para excluir a regra.", 500);

  return NextResponse.json({ ok: true });
}
