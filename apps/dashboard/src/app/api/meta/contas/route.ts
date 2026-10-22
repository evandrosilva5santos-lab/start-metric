import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth/session";
import {
  listOperationalAccounts,
  OperationalAccountError,
} from "@/lib/accounts/operational";

export const dynamic = "force-dynamic";

/** Inventário operacional. A descoberta completa permanece em Integrações/Carteira. */
export async function GET(): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const [inventory, everyPlatform] = await Promise.all([
      listOperationalAccounts(session.supabase, session.orgId, "meta"),
      listOperationalAccounts(session.supabase, session.orgId),
    ]);
    const authorizedClientIds = new Set(inventory.accounts.map((account) => account.client_id));
    // Visão geral "Google" e "Meta + Google": clientes com conta em qualquer plataforma.
    const anyPlatformClientIds = new Set(everyPlatform.accounts.map((account) => account.client_id));

    return NextResponse.json({
      contas: inventory.accounts.map((account) => ({
        id: account.external_id,
        name: account.name || account.external_id,
        currency: account.currency || "BRL",
        timezone_name: account.timezone || "America/Sao_Paulo",
        statusText: "Ativa",
        isActive: true,
        clientId: account.client_id,
        platform: account.platform,
      })),
      clientes: inventory.clients
        .filter((client) => authorizedClientIds.has(client.id))
        .map((client) => ({ id: client.id, name: client.name })),
      clientesTodos: everyPlatform.clients
        .filter((client) => anyPlatformClientIds.has(client.id))
        .map((client) => ({ id: client.id, name: client.name })),
      total: inventory.accounts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof OperationalAccountError) {
      return NextResponse.json(
        { error: "Não foi possível carregar as contas autorizadas.", code: error.code },
        { status: error.status },
      );
    }
    console.error("[meta/contas] Falha inesperada:", error);
    return NextResponse.json({ error: "Erro interno ao carregar contas." }, { status: 500 });
  }
}

