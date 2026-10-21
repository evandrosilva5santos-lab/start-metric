// Google Ads da organização: GET devolve configuração, conexão e contas;
// POST executa uma ação (conectar com conta de serviço, testar, buscar contas, sincronizar).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { configChecklist } from "@/lib/google-ads/client";
import {
  connectServiceAccount,
  discoverAccounts,
  getConnection,
  googleErrorMessage,
  syncGoogleOrg,
  testGoogleConnection,
} from "@/lib/google-ads/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYNC_BUDGET_MS = 40_000;
const actionSchema = z.object({ action: z.enum(["connect_service_account", "test", "discover", "sync"]) });

export async function GET() {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = createAdminClient();
  try {
    const [connection, { data: accounts, error }, { data: clients }] = await Promise.all([
      getConnection(db as never, session.orgId),
      db
        .from("ad_accounts")
        .select("id, external_id, name, currency, timezone, status, client_id, last_synced_at")
        .eq("org_id", session.orgId)
        .eq("platform", "google")
        .order("name"),
      db.from("clients").select("id, name").eq("org_id", session.orgId).is("archived_at", null).order("name"),
    ]);
    if (error) throw new Error(error.message);
    return NextResponse.json({
      config: configChecklist(),
      connection: connection
        ? {
            mode: connection.mode,
            status: connection.status,
            email: connection.google_email,
            loginCustomerId: connection.login_customer_id,
            lastError: connection.last_error,
            connectedAt: connection.connected_at,
          }
        : null,
      accounts: accounts ?? [],
      clients: clients ?? [],
    });
  } catch (err) {
    console.error("[google-ads] status:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao carregar a integração Google Ads" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  const db = createAdminClient() as never;
  const orgId = session.orgId;
  const serviceAccountEmail = configChecklist().serviceAccountEmail;
  try {
    switch (parsed.data.action) {
      case "connect_service_account": {
        await connectServiceAccount(db, orgId);
        return NextResponse.json({ ok: true, ...(await discoverAccounts(db, orgId)) });
      }
      case "test":
        return NextResponse.json({ ok: true, steps: await testGoogleConnection(db, orgId) });
      case "discover":
        return NextResponse.json({ ok: true, ...(await discoverAccounts(db, orgId)) });
      case "sync":
        return NextResponse.json({ ok: true, ...(await syncGoogleOrg(db, orgId, { budgetMs: SYNC_BUDGET_MS })) });
    }
  } catch (err) {
    console.error(`[google-ads] ${parsed.data.action}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: googleErrorMessage(err, serviceAccountEmail) }, { status: 400 });
  }
}
