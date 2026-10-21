import { NextResponse } from "next/server";
import { listAssignees } from "@/lib/alerts/queries";
import { jsonError, requireAlertsAuth } from "@/lib/alerts/server";

export async function GET(): Promise<NextResponse> {
  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ me: auth.userId, assignees: await listAssignees(auth) });
  } catch {
    return jsonError("Não deu para carregar a equipe.", 500);
  }
}
