// Abas de análise do Google Ads: palavras-chave, termos de busca, dispositivo, sexo, idade, local e visibilidade.
// Busca ao vivo no Google, só leitura, restrita às contas da organização da sessão.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleAdsApiError } from "@/lib/google-ads/client";
import { fetchInsights, INSIGHT_KINDS, InsightInputError } from "@/lib/google-ads/insights-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SPAN_DAYS = 366;
const DAY_MS = 86_400_000;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  kind: z.enum(INSIGHT_KINDS),
  accountId: z.string().uuid(),
  from: day,
  to: day,
  campaignId: z.string().regex(/^\d{1,20}$/).optional(),
  level: z.enum(["country", "region", "city"]).default("city"),
  locationType: z.enum(["presence", "interest"]).default("presence"),
});

const FIXED_ERRORS: Record<string, { status: number; message: string }> = {
  quota: { status: 429, message: "O Google limitou as consultas por agora. Tente de novo em instantes." },
  no_access: { status: 403, message: "A conexão atual não tem acesso a esta conta no Google Ads." },
  auth: { status: 502, message: "A conexão com o Google expirou. Reconecte em Integrações." },
  config: { status: 503, message: "O Google Ads ainda não está configurado nesta organização." },
  developer_token_not_approved: { status: 502, message: "O token de desenvolvedor do Google Ads ainda não foi aprovado para esta conta." },
};

export async function GET(request: NextRequest) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  const params = parsed.data;
  const span = (Date.parse(`${params.to}T00:00:00Z`) - Date.parse(`${params.from}T00:00:00Z`)) / DAY_MS;
  const notInFuture = Date.parse(`${params.to}T00:00:00Z`) <= Date.now() + DAY_MS;
  if (!(span >= 0 && span < MAX_SPAN_DAYS && notInFuture)) return NextResponse.json({ error: "Período inválido" }, { status: 400 });

  try {
    const result = await fetchInsights(createAdminClient() as never, { ...params, orgId: session.orgId });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    if (err instanceof InsightInputError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[google-ads/insights]", params.kind, err instanceof Error ? err.message : err);
    if (err instanceof GoogleAdsApiError) {
      const fixed = FIXED_ERRORS[err.kind];
      if (fixed) return NextResponse.json({ error: fixed.message }, { status: fixed.status });
      return NextResponse.json(
        { error: "O Google recusou esta consulta para esta conta ou tipo de campanha.", detail: err.code ?? err.message.slice(0, 200) },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Erro ao buscar os dados do Google Ads" }, { status: 500 });
  }
}
