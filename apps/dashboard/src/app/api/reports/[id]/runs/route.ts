import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readIdParam, requireReportsSession, serverError } from "@/lib/reports/http";
import { RUN_COLUMNS, reportExists } from "@/lib/reports/repository";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null): number | null {
  if (raw === null) return DEFAULT_LIMIT;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_LIMIT ? value : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const { db, orgId } = auth.value;
  const id = await readIdParam(params);
  if (!id.ok) return id.response;
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  if (limit === null) return jsonError(400, `limit deve ser um inteiro entre 1 e ${MAX_LIMIT}`);

  try {
    if (!(await reportExists(db, orgId, id.value))) return jsonError(404, "Relatório não encontrado");
    const { data, error } = await db
      .from("report_runs")
      .select(RUN_COLUMNS)
      .eq("report_id", id.value)
      .eq("org_id", orgId)
      .order("scheduled_for", { ascending: false })
      .limit(limit);
    if (error) return serverError("listar gerações", error);
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return serverError("listar gerações", err);
  }
}
