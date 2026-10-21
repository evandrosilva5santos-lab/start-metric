import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth/session";
import {
  listOperationalAccounts,
  OperationalAccountError,
} from "@/lib/accounts/operational";

type AccountResponse = {
  id: string;
  name: string;
  currency: string | null;
  is_active: true;
  account_status: 1;
  client_id: string;
};

export async function GET(): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const inventory = await listOperationalAccounts(session.supabase, session.orgId, "meta");
    const accounts: AccountResponse[] = inventory.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      is_active: true,
      account_status: 1,
      client_id: account.client_id!,
    }));
    return NextResponse.json(accounts);
  } catch (error) {
    if (error instanceof OperationalAccountError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[meta/accounts] Falha inesperada:", error);
    return NextResponse.json({ error: "Erro ao buscar contas Meta" }, { status: 500 });
  }
}
