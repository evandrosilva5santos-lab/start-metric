import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readIdParam, readJson, requireReportsSession, serverError } from "@/lib/reports/http";
import { deliverySchema } from "@/lib/reports/schema";

type Params = { params: Promise<{ id: string }> };

const RPC_ERRORS: Readonly<Record<string, { status: number; message: string }>> = {
  "42501": { status: 403, message: "Sessão sem usuário ou organização." },
  "22023": { status: 400, message: "Passo de entrega inválido." },
  "22001": { status: 400, message: "Nota excede 2000 caracteres." },
  P0002: { status: 404, message: "Relatório gerado não encontrado." },
  "55000": { status: 409, message: "Passo fora de ordem: a esteira é gerado → enviado → recebido → aprovado." },
};

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const { db, userId, isPainel } = auth.value;
  if (isPainel || !userId) {
    return jsonError(403, "Registrar envio exige login com usuário: a entrega fica registrada em nome de quem a fez. Entre com sua conta.");
  }
  const id = await readIdParam(params);
  if (!id.ok) return id.response;
  const body = await readJson(request, deliverySchema);
  if (!body.ok) return body.response;

  try {
    const { data, error } = await db.rpc("register_report_delivery", {
      p_run_id: id.value,
      p_step: body.value.step,
      p_note: body.value.note ?? null,
    });
    if (error) {
      const known = error.code ? RPC_ERRORS[error.code] : undefined;
      if (known) return jsonError(known.status, known.message);
      return serverError("registrar entrega", error);
    }
    if (!data) return jsonError(404, "Relatório gerado não encontrado.");
    const { org_id: _orgId, ...run } = data;
    return NextResponse.json({ data: run });
  } catch (err) {
    return serverError("registrar entrega", err);
  }
}
