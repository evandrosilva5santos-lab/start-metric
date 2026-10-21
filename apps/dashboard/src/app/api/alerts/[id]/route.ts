import { NextResponse } from "next/server";
import { assignAlert } from "@/lib/alerts/queries";
import { alertIdSchema, assignBodySchema, firstIssue } from "@/lib/alerts/schemas";
import { jsonError, readJson, requireAlertsAuth } from "@/lib/alerts/server";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  if (!alertIdSchema.safeParse(id).success) return jsonError("Alerta inválido.", 400);

  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  const json = await readJson(request);
  if (!json.ok) return jsonError("Payload inválido", 400);
  const parsed = assignBodySchema.safeParse(json.body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  try {
    const outcome = await assignAlert(auth, id, parsed.data.assigned_to);
    if (!outcome.ok) return jsonError(outcome.error, outcome.status);
    return NextResponse.json(outcome.item);
  } catch {
    return jsonError("Não deu para atribuir. Tente de novo.", 500);
  }
}
