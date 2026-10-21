import { NextResponse } from "next/server";
import { transitionAlert } from "@/lib/alerts/queries";
import { alertIdSchema, firstIssue, resolveBodySchema } from "@/lib/alerts/schemas";
import { jsonError, readJson, requireAlertsAuth } from "@/lib/alerts/server";
import { resolvePatch } from "@/lib/alerts/triage";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  if (!alertIdSchema.safeParse(id).success) return jsonError("Alerta inválido.", 400);

  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  const json = await readJson(request);
  if (!json.ok) return jsonError("Payload inválido", 400);
  const parsed = resolveBodySchema.safeParse(json.body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error), 422);

  const outcome = await transitionAlert(auth, id, "resolve", (current) =>
    resolvePatch(current, parsed.data.note, new Date()),
  );
  if (!outcome.ok) return jsonError(outcome.error, outcome.status);
  return NextResponse.json(outcome.item);
}
