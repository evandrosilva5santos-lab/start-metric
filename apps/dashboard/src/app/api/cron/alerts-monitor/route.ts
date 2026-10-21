import { NextResponse } from "next/server";
import { runAlertsMonitor } from "@/lib/alerts/evaluator";

const CRON_SECRET = process.env.CRON_SECRET;

// Só o segredo: o cabeçalho x-vercel-cron pode ser forjado por qualquer um.
function isCronAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  return token === CRON_SECRET;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await runAlertsMonitor();
    const durationMs = Date.now() - startedAt;
    return NextResponse.json({
      ok: true,
      ...result,
      durationMs,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export { POST as GET };
