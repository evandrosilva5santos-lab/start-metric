// "Testar agora": mostra o que a regra faria com os números de agora. Não grava nada e não toca na conta.

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateRule, type RuleRow } from "@/lib/automation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: rule } = await db.from("automation_rules").select("*").eq("org_id", session.orgId).eq("id", id).maybeSingle();
  if (!rule) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });

  try {
    const result = await evaluateRule(db, rule as RuleRow, { now: new Date(), dryRun: true });
    return NextResponse.json({
      decisions: result.decisions.map((d) => ({
        campaign: d.entity.name,
        campaignId: d.entity.externalId,
        description: d.description,
        skipped: d.skipped,
        action: d.action,
      })),
    });
  } catch (err) {
    console.error("[automation/test]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao testar a regra" }, { status: 500 });
  }
}
