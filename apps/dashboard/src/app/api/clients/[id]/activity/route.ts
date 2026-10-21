// Histórico de um cliente: itens de trabalho agrupados e situação da sincronização.

import { NextRequest, NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth/session";
import { addDays, localDay } from "@/lib/activity/meta/window";
import { clientAccounts, clientSyncStatus, clientTimezone, listClientActivity } from "@/lib/activity/queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 92;

export async function GET(request: NextRequest, { params }: { params: Params }) {
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

  const db = session.supabase as never;
  try {
    const accounts = await clientAccounts(db, session.orgId, id);
    const timezone = clientTimezone(accounts);
    const today = localDay(Math.floor(Date.now() / 1000), timezone);
    const search = request.nextUrl.searchParams;
    const to = search.get("to") ?? today;
    const from = search.get("from") ?? addDays(to, -6);
    const scope = search.get("scope") === "all" ? "all" : "work";

    if (!DAY.test(from) || !DAY.test(to) || from > to || addDays(from, MAX_SPAN_DAYS) < to) {
      return NextResponse.json({ error: "Período inválido (máximo de 92 dias)." }, { status: 400 });
    }

    const [activity, sync] = await Promise.all([
      listClientActivity(db, { orgId: session.orgId, clientId: id, from, to, timezone, scope }),
      clientSyncStatus(db, session.orgId, accounts, from, to <= today ? to : today),
    ]);
    return NextResponse.json({ timezone, from, to, scope, accounts: accounts.length, ...activity, sync });
  } catch (err) {
    console.error("[clients/activity] Erro:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Não foi possível carregar o histórico." }, { status: 500 });
  }
}
