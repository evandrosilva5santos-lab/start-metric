// Relatório Google Ads do painel: indicadores do período, comparação, série diária e campanhas.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleReport } from "@/lib/google-ads/report";

export const dynamic = "force-dynamic";

const MAX_SPAN_DAYS = 366;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const querySchema = z.object({
  from: day,
  to: day,
  clientId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  const { from, to, clientId, accountId } = parsed.data;
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!(span >= 0 && span < MAX_SPAN_DAYS)) return NextResponse.json({ error: "Período inválido" }, { status: 400 });

  try {
    const report = await getGoogleReport(createAdminClient() as never, { orgId: session.orgId, from, to, clientId, accountId });
    return NextResponse.json(report);
  } catch (err) {
    console.error("[google-ads/report]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao montar o relatório Google Ads" }, { status: 500 });
  }
}
