import { NextResponse } from "next/server";
import { transitionAlert } from "@/lib/alerts/queries";
import { alertIdSchema } from "@/lib/alerts/schemas";
import { jsonError, requireAlertsAuth } from "@/lib/alerts/server";
import { acknowledgePatch } from "@/lib/alerts/triage";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  if (!alertIdSchema.safeParse(id).success) return jsonError("Alerta inválido.", 400);

  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  const outcome = await transitionAlert(auth, id, "acknowledge", (current) => acknowledgePatch(current, new Date()));
  if (!outcome.ok) return jsonError(outcome.error, outcome.status);
  return NextResponse.json(outcome.item);
}
