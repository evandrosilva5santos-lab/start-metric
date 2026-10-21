import { NextResponse, type NextRequest } from "next/server";
import { createReportsAdminDb } from "@/lib/reports/data";
import { generateReportRun, truncateToMinute } from "@/lib/reports/generate";
import { jsonError, readIdParam, requireReportsSession, serverError } from "@/lib/reports/http";
import { reportExists } from "@/lib/reports/repository";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// O cron usa o segundo 0 de cada minuto; a geração manual usa o segundo 30 para nunca ocupar a vaga agendada.
const MANUAL_SLOT_OFFSET_MS = 30_000;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const { db, orgId } = auth.value;
  const id = await readIdParam(params);
  if (!id.ok) return id.response;
  const rl = rateLimit(`reports-generate:${orgId}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) return jsonError(429, `Muitas gerações seguidas. Tente de novo em ${rl.retryAfterSeconds}s.`);

  try {
    if (!(await reportExists(db, orgId, id.value))) return jsonError(404, "Relatório não encontrado");

    const result = await generateReportRun({
      reportId: id.value,
      orgId,
      scheduledFor: new Date(truncateToMinute(new Date()).getTime() + MANUAL_SLOT_OFFSET_MS),
      supabaseAdmin: createReportsAdminDb(),
    });
    if (result.skipped) return jsonError(409, "Este relatório já foi gerado neste minuto. Aguarde e tente de novo.");

    return NextResponse.json(
      {
        data: {
          run_id: result.runId,
          status: result.status,
          rendered_body: result.renderedBody,
          missing_variables: result.missing,
          warnings: result.warnings,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return serverError("gerar relatório", err);
  }
}
