import { NextResponse } from "next/server";
import { createReportsAdminDb, type ReportsDb } from "@/lib/reports/data";
import { generateReportRun } from "@/lib/reports/generate";
import { STUCK_RUN_MESSAGE, runDispatch, type DispatchDeps, type DueReportRow } from "@/lib/reports/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const DUE_COLUMNS = "id, org_id, status, frequency, send_time, weekday, month_day, timezone, next_run_at";

// Só o segredo: o cabeçalho x-vercel-cron pode ser forjado por qualquer um.
function isCronAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  return token === CRON_SECRET;
}

function supabaseDeps(db: ReportsDb): DispatchDeps {
  return {
    now: () => new Date(),
    async recoverStuckRuns(cutoffIso) {
      const { data, error } = await db
        .from("report_runs")
        .update({ status: "failed", error_message: STUCK_RUN_MESSAGE, finished_at: new Date().toISOString() })
        .eq("status", "queued")
        .lt("created_at", cutoffIso)
        .select("id");
      if (error) throw new Error(error.message);
      return data?.length ?? 0;
    },
    async loadDueReports(nowIso, limit) {
      const { data, error, count } = await db
        .from("reports")
        .select(DUE_COLUMNS, { count: "exact" })
        .eq("status", "active")
        .lte("next_run_at", nowIso)
        .order("next_run_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`Falha ao buscar relatórios vencidos: ${error.message}`);
      const rows: DueReportRow[] = data ?? [];
      return { rows, total: count ?? rows.length };
    },
    generate: (row) =>
      generateReportRun({
        reportId: row.id,
        orgId: row.org_id,
        scheduledFor: new Date(row.next_run_at ?? ""),
        supabaseAdmin: db,
      }),
    async advance(row, nextRunAt) {
      if (!row.next_run_at) return false;
      const patch = nextRunAt === null ? { status: "paused", next_run_at: null } : { next_run_at: nextRunAt };
      const { data, error } = await db
        .from("reports")
        .update(patch)
        .eq("id", row.id)
        .eq("org_id", row.org_id)
        .eq("status", "active")
        .eq("next_run_at", row.next_run_at)
        .select("id");
      if (error) throw new Error(error.message);
      return (data?.length ?? 0) > 0;
    },
    log(message, err) {
      console.error(`[cron/reports-dispatch] ${message}`, err instanceof Error ? err.message : (err ?? ""));
    },
  };
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const summary = await runDispatch(supabaseDeps(createReportsAdminDb()));
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron/reports-dispatch] Falha no disparo:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Falha ao disparar relatórios agendados" }, { status: 500 });
  }
}

export { POST as GET };
