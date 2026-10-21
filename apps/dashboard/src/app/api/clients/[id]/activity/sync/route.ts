// Botão "Atualizar" do histórico: sincroniza as contas do cliente agora (no máximo 1 vez a cada 5 min por conta).

import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientAccounts } from "@/lib/activity/queries";
import { syncAccountsHistory, type ActivityAccount } from "@/lib/activity/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUDGET_MS = 40_000;
const MAX_DAYS_PER_ACCOUNT = 10;

type Params = Promise<{ id: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: client } = await session.supabase
    .from("clients")
    .select("id")
    .eq("id", id)
    .eq("org_id", session.orgId)
    .is("archived_at", null)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const db = createAdminClient();
  const accounts = await clientAccounts(db as never, session.orgId, id);
  if (accounts.length === 0) {
    return NextResponse.json({ error: "Este cliente ainda não tem conta de anúncios ligada.", code: "no_accounts" }, { status: 400 });
  }

  const { data: rows } = await db
    .from("ad_accounts")
    .select("id, org_id, external_id, token_encrypted, timezone")
    .eq("org_id", session.orgId)
    .in("id", accounts.map((a) => a.id));
  const outcomes = await syncAccountsHistory(db as never, (rows ?? []) as ActivityAccount[], {
    trigger: "manual",
    budgetMs: BUDGET_MS,
    maxDays: MAX_DAYS_PER_ACCOUNT,
  });

  const results = outcomes.flatMap((o) => ("result" in o ? [o.result] : []));
  return NextResponse.json({
    accounts: accounts.length,
    synced: results.length,
    skipped: outcomes.length - results.length,
    inserted: results.reduce((sum, r) => sum + r.inserted, 0),
    status: results.some((r) => r.status === "failed") ? "failed" : results.some((r) => r.status === "partial") ? "partial" : "succeeded",
    expired: results.some((r) => r.errorCode === "expired"),
  });
}
