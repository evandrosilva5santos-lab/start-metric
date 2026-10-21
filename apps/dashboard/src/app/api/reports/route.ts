import { NextResponse, type NextRequest } from "next/server";
import { createReportSchema } from "@/lib/reports/schema";
import { isUuid, jsonError, readJson, requireReportsSession, serverError } from "@/lib/reports/http";
import {
  REPORT_COLUMNS,
  ReportValidationError,
  assertAccountsAllowed,
  assertClientInOrg,
  fetchReport,
  nextRunAtFor,
  replaceParts,
} from "@/lib/reports/repository";

const LIST_LIMIT = 500;

interface LatestRun {
  id: string;
  status: string;
  scheduled_for: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const { db, orgId } = auth.value;

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (clientId !== null && !isUuid(clientId)) return jsonError(400, "client_id inválido");

  try {
    let query = db
      .from("reports")
      .select(`${REPORT_COLUMNS}, clients(name), report_runs(id, status, scheduled_for, created_at)`)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .order("created_at", { referencedTable: "report_runs", ascending: false })
      .limit(1, { referencedTable: "report_runs" })
      .limit(LIST_LIMIT);
    if (clientId) query = query.eq("client_id", clientId);

    const { data, error } = await query;
    if (error) return serverError("listar relatórios", error);

    const reports = (data ?? []).map(({ clients, report_runs, ...report }) => ({
      ...report,
      client_name: clients?.name ?? null,
      latest_run: ((report_runs ?? []) as LatestRun[])[0] ?? null,
    }));
    return NextResponse.json({ data: reports });
  } catch (err) {
    return serverError("listar relatórios", err);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const { db, orgId } = auth.value;

  const body = await readJson(request, createReportSchema);
  if (!body.ok) return body.response;
  const { parts, ...fields } = body.value;

  try {
    await assertClientInOrg(db, orgId, fields.client_id);
    await assertAccountsAllowed(db, orgId, fields.client_id, parts.flatMap((p) => (p.ad_account_id ? [p.ad_account_id] : [])));

    const { data: created, error } = await db
      .from("reports")
      .insert({
        org_id: orgId,
        client_id: fields.client_id,
        name: fields.name,
        status: fields.status,
        frequency: fields.frequency,
        send_time: fields.send_time,
        weekday: fields.weekday,
        month_day: fields.month_day,
        timezone: fields.timezone,
        next_run_at: nextRunAtFor(fields),
      })
      .select("id")
      .single();
    if (error || !created) return serverError("criar relatório", error);

    try {
      await replaceParts(db, created.id, parts);
    } catch (err) {
      await db.from("reports").delete().eq("id", created.id).eq("org_id", orgId);
      return serverError("criar partes do relatório", err);
    }

    return NextResponse.json({ data: await fetchReport(db, orgId, created.id) }, { status: 201 });
  } catch (err) {
    if (err instanceof ReportValidationError) return jsonError(err.status, err.message);
    return serverError("criar relatório", err);
  }
}
