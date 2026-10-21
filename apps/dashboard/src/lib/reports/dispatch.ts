import type { GenerationResult } from "./generate-core";
import { computeNextRunAt, type ReportFrequency } from "./schedule";

export const DISPATCH_BATCH_SIZE = 25;
export const DISPATCH_TIME_BUDGET_MS = 50_000;
export const MIN_TIME_PER_REPORT_MS = 10_000;
export const STUCK_RUN_AFTER_MS = 10 * 60_000;
export const STUCK_RUN_MESSAGE = "Geração interrompida (tempo esgotado)";

export interface DueReportRow {
  id: string;
  org_id: string;
  status: string;
  frequency: string;
  send_time: string;
  weekday: number | null;
  month_day: number | null;
  timezone: string;
  next_run_at: string | null;
}

export interface StuckRunCandidate {
  status: string;
  created_at: string;
}

export type DispatchOutcome = "generated" | "skipped" | "failed";

export interface DispatchSummary {
  due: number;
  generated: number;
  skipped: number;
  failed: number;
  recovered: number;
  remaining: number;
}

export interface DispatchDeps {
  now(): Date;
  recoverStuckRuns(cutoffIso: string): Promise<number>;
  loadDueReports(nowIso: string, limit: number): Promise<{ rows: DueReportRow[]; total: number }>;
  generate(row: DueReportRow): Promise<GenerationResult>;
  advance(row: DueReportRow, nextRunAt: string | null): Promise<boolean>;
  log(message: string, err?: unknown): void;
}

function timeOf(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.NaN;
}

export function isReportDue(row: DueReportRow, now: Date): boolean {
  if (row.status !== "active") return false;
  const due = timeOf(row.next_run_at);
  return Number.isFinite(due) && due <= now.getTime();
}

export function selectDueReports(rows: readonly DueReportRow[], now: Date, limit: number = DISPATCH_BATCH_SIZE): DueReportRow[] {
  return rows
    .filter((row) => isReportDue(row, now))
    .sort((a, b) => timeOf(a.next_run_at) - timeOf(b.next_run_at))
    .slice(0, limit);
}

export function nextRunAfter(row: DueReportRow, now: Date): string | null {
  const previous = timeOf(row.next_run_at);
  const from = Number.isFinite(previous) ? new Date(Math.max(now.getTime(), previous)) : now;
  try {
    return computeNextRunAt(
      {
        frequency: row.frequency as ReportFrequency,
        sendTime: row.send_time,
        weekday: row.weekday,
        monthDay: row.month_day,
        timezone: row.timezone,
      },
      from,
    );
  } catch {
    return null;
  }
}

export function hasTimeForAnother(startedAtMs: number, nowMs: number): boolean {
  return nowMs - startedAtMs + MIN_TIME_PER_REPORT_MS <= DISPATCH_TIME_BUDGET_MS;
}

export function stuckRunCutoff(now: Date): string {
  return new Date(now.getTime() - STUCK_RUN_AFTER_MS).toISOString();
}

export function isStuckRun(run: StuckRunCandidate, now: Date): boolean {
  return run.status === "queued" && timeOf(run.created_at) < timeOf(stuckRunCutoff(now));
}

export function outcomeOf(result: GenerationResult): DispatchOutcome {
  return result.skipped ? "skipped" : result.status;
}

async function recover(deps: DispatchDeps, now: Date): Promise<number> {
  try {
    return await deps.recoverStuckRuns(stuckRunCutoff(now));
  } catch (err) {
    deps.log("Falha ao recuperar runs travados", err);
    return 0;
  }
}

async function dispatchOne(deps: DispatchDeps, row: DueReportRow): Promise<DispatchOutcome> {
  let outcome: DispatchOutcome;
  try {
    outcome = outcomeOf(await deps.generate(row));
  } catch (err) {
    deps.log(`Falha ao gerar o relatório ${row.id}`, err);
    outcome = "failed";
  }

  const nextRunAt = nextRunAfter(row, deps.now());
  if (nextRunAt === null) deps.log(`Agenda inválida no relatório ${row.id}; relatório pausado`);
  try {
    await deps.advance(row, nextRunAt);
  } catch (err) {
    deps.log(`Falha ao avançar a agenda do relatório ${row.id}`, err);
  }
  return outcome;
}

export async function runDispatch(deps: DispatchDeps): Promise<DispatchSummary> {
  const startedAt = deps.now();
  const recovered = await recover(deps, startedAt);
  const { rows, total } = await deps.loadDueReports(startedAt.toISOString(), DISPATCH_BATCH_SIZE);
  const queue = selectDueReports(rows, startedAt);

  const counts: Record<DispatchOutcome, number> = { generated: 0, skipped: 0, failed: 0 };
  let attempted = 0;
  for (const row of queue) {
    if (!hasTimeForAnother(startedAt.getTime(), deps.now().getTime())) break;
    const outcome = await dispatchOne(deps, row);
    counts[outcome] += 1;
    attempted += 1;
  }

  return { due: total, ...counts, recovered, remaining: Math.max(0, total - attempted) };
}
