import { NextResponse, type NextRequest } from "next/server";
import { scheduleSchema, updateReportSchema, type UpdateReportInput } from "@/lib/reports/schema";
import { jsonError, readIdParam, readJson, requireReportsSession, serverError } from "@/lib/reports/http";
import {
  ReportValidationError,
  assertAccountsAllowed,
  assertClientInOrg,
  fetchReport,
  nextRunAtFor,
  replaceParts,
  type ReportView,
} from "@/lib/reports/repository";

type Params = { params: Promise<{ id: string }> };

const SCHEDULE_KEYS = ["status", "frequency", "send_time", "weekday", "month_day", "timezone"] as const;

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const id = await readIdParam(params);
  if (!id.ok) return id.response;

  try {
    const report = await fetchReport(auth.value.db, auth.value.orgId, id.value);
    if (!report) return jsonError(404, "Relatório não encontrado");
    return NextResponse.json({ data: report });
  } catch (err) {
    return serverError("ler relatório", err);
  }
}

function accountIdsToCheck(existing: ReportView, patch: UpdateReportInput, clientChanged: boolean): string[] {
  const parts = patch.parts ?? (clientChanged ? existing.parts : []);
  return parts.flatMap((p) => (p.ad_account_id ? [p.ad_account_id] : []));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const { db, orgId } = auth.value;
  const id = await readIdParam(params);
  if (!id.ok) return id.response;
  const body = await readJson(request, updateReportSchema);
  if (!body.ok) return body.response;
  const { parts, ...patch } = body.value;

  try {
    const existing = await fetchReport(db, orgId, id.value);
    if (!existing) return jsonError(404, "Relatório não encontrado");

    const schedule = scheduleSchema.safeParse({
      status: patch.status ?? existing.status,
      frequency: patch.frequency ?? existing.frequency,
      send_time: patch.send_time ?? existing.send_time,
      weekday: patch.weekday !== undefined ? patch.weekday : existing.weekday,
      month_day: patch.month_day !== undefined ? patch.month_day : existing.month_day,
      timezone: patch.timezone ?? existing.timezone,
    });
    if (!schedule.success) return jsonError(400, "Agenda inválida", schedule.error.issues);

    const clientId = patch.client_id ?? existing.client_id;
    const clientChanged = clientId !== existing.client_id;
    if (clientChanged) await assertClientInOrg(db, orgId, clientId);
    await assertAccountsAllowed(db, orgId, clientId, accountIdsToCheck(existing, body.value, clientChanged));

    const scheduleChanged = SCHEDULE_KEYS.some((key) => patch[key] !== undefined);
    const changes = { ...patch, ...(scheduleChanged ? { next_run_at: nextRunAtFor(schedule.data) } : {}) };
    if (Object.keys(changes).length > 0) {
      const { error } = await db.from("reports").update(changes).eq("id", id.value).eq("org_id", orgId);
      if (error) return serverError("atualizar relatório", error);
    }

    if (parts) await replaceParts(db, id.value, parts);
    return NextResponse.json({ data: await fetchReport(db, orgId, id.value) });
  } catch (err) {
    if (err instanceof ReportValidationError) return jsonError(err.status, err.message);
    return serverError("atualizar relatório", err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const id = await readIdParam(params);
  if (!id.ok) return id.response;

  try {
    const { data, error } = await auth.value.db
      .from("reports")
      .delete()
      .eq("id", id.value)
      .eq("org_id", auth.value.orgId)
      .select("id");
    if (error) return serverError("excluir relatório", error);
    if (!data || data.length === 0) return jsonError(404, "Relatório não encontrado");
    return NextResponse.json({ data: { id: id.value } });
  } catch (err) {
    return serverError("excluir relatório", err);
  }
}
