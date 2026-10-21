import "server-only";

import type { Database } from "@/lib/supabase/types";
import type { ReportsDb } from "@/lib/reports/data";
import type { ReportPartInput } from "@/lib/reports/schema";
import { computeNextRunAt, type ReportFrequency } from "@/lib/reports/schedule";
import { listOperationalAccounts } from "@/lib/accounts/operational";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
type PartRow = Database["public"]["Tables"]["report_parts"]["Row"];
type RunRow = Database["public"]["Tables"]["report_runs"]["Row"];

export const REPORT_COLUMNS =
  "id, client_id, name, status, frequency, send_time, weekday, month_day, timezone, next_run_at, created_at, updated_at";
export const PART_COLUMNS = "id, position, ad_account_id, period, custom_start, custom_end, body, send_without_data";
export const RUN_COLUMNS =
  "id, report_id, scheduled_for, status, rendered_body, missing_variables, error_message, started_at, finished_at, sent_at, received_at, approved_at, sent_by, delivery_note, created_at";

export type ReportPartView = Omit<PartRow, "report_id">;
export type ReportView = Omit<ReportRow, "org_id"> & { client_name: string | null; parts: ReportPartView[] };
export type RunView = Omit<RunRow, "org_id">;

export interface ScheduleValues {
  status: string;
  frequency: string;
  send_time: string;
  weekday: number | null;
  month_day: number | null;
  timezone: string;
}

export class ReportValidationError extends Error {
  readonly status = 422;
}

export function nextRunAtFor(schedule: ScheduleValues, now: Date = new Date()): string | null {
  if (schedule.status !== "active") return null;
  return computeNextRunAt(
    {
      frequency: schedule.frequency as ReportFrequency,
      sendTime: schedule.send_time,
      weekday: schedule.weekday,
      monthDay: schedule.month_day,
      timezone: schedule.timezone,
    },
    now,
  );
}

export async function assertClientInOrg(db: ReportsDb, orgId: string, clientId: string): Promise<void> {
  const { data, error } = await db
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`Falha ao validar cliente: ${error.message}`);
  if (!data) throw new ReportValidationError("Cliente não encontrado nesta organização.");
}

export async function assertAccountsAllowed(
  db: ReportsDb,
  orgId: string,
  clientId: string,
  accountIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(accountIds)];
  if (unique.length === 0) return;
  const inventory = await listOperationalAccounts(db, orgId);
  const allowed = new Set(
    inventory.accounts
      .filter((account) => account.client_id === clientId)
      .map((account) => account.id),
  );
  if (unique.some((id) => !allowed.has(id))) {
    throw new ReportValidationError("Conta de anúncio não encontrada nesta organização ou ligada a outro cliente.");
  }
}

function partRows(reportId: string, parts: readonly ReportPartInput[]): Database["public"]["Tables"]["report_parts"]["Insert"][] {
  return parts.map((part, position) => ({
    report_id: reportId,
    position,
    ad_account_id: part.ad_account_id,
    period: part.period,
    custom_start: part.period === "custom" ? part.custom_start : null,
    custom_end: part.period === "custom" ? part.custom_end : null,
    body: part.body,
    send_without_data: part.send_without_data,
  }));
}

export async function replaceParts(db: ReportsDb, reportId: string, parts: readonly ReportPartInput[]): Promise<void> {
  const { error: upsertError } = await db
    .from("report_parts")
    .upsert(partRows(reportId, parts), { onConflict: "report_id,position" });
  if (upsertError) throw new Error(`Falha ao salvar partes: ${upsertError.message}`);
  const { error: deleteError } = await db.from("report_parts").delete().eq("report_id", reportId).gte("position", parts.length);
  if (deleteError) throw new Error(`Falha ao remover partes antigas: ${deleteError.message}`);
}

export async function fetchReport(db: ReportsDb, orgId: string, reportId: string): Promise<ReportView | null> {
  const { data, error } = await db
    .from("reports")
    .select(`${REPORT_COLUMNS}, clients(name), report_parts(${PART_COLUMNS})`)
    .eq("id", reportId)
    .eq("org_id", orgId)
    .order("position", { referencedTable: "report_parts", ascending: true })
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler relatório: ${error.message}`);
  if (!data) return null;
  const { clients, report_parts, ...report } = data;
  return { ...report, client_name: clients?.name ?? null, parts: report_parts ?? [] };
}

export async function reportExists(db: ReportsDb, orgId: string, reportId: string): Promise<boolean> {
  const { data, error } = await db.from("reports").select("id").eq("id", reportId).eq("org_id", orgId).maybeSingle();
  if (error) throw new Error(`Falha ao ler relatório: ${error.message}`);
  return Boolean(data);
}
