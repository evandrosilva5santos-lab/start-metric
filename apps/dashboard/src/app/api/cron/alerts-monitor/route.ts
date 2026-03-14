import { NextResponse } from "next/server";
import { runAlertsMonitor } from "@/lib/alerts/evaluator";

const CRON_SECRET = process.env.CRON_SECRET;

function isCronAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization") ?? request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (CRON_SECRET && token === CRON_SECRET) return true;

  const vercelCron = request.headers.get("x-vercel-cron");
  if (process.env.VERCEL && vercelCron === "1") return true;

  return false;
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
