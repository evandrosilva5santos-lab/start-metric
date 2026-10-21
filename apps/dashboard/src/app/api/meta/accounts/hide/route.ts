import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { HIDDEN_ACCOUNT_STATUS } from "@/lib/meta/account-groups";

export const dynamic = "force-dynamic";

const HIDE_LIMIT = { limit: 30, windowMs: 5 * 60 * 1000 };

const hideSchema = z.object({
  accountIds: z.array(z.string().uuid("Conta inválida")).min(1).max(500),
  force: z.boolean().default(false),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const limited = rateLimit(`meta-hide:${session.orgId}`, HIDE_LIMIT);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Muitas alterações seguidas. Aguarde um pouco e tente de novo.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const parsed = hideSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });
  }
  const accountIds = [...new Set(parsed.data.accountIds)];

  const [accountsResult, clientsResult] = await Promise.all([
    session.supabase
      .from("ad_accounts")
      .select("id, name, external_id, client_id")
      .eq("org_id", session.orgId)
      .eq("platform", "meta")
      .in("id", accountIds),
    session.supabase.from("clients").select("id, name").eq("org_id", session.orgId).is("archived_at", null),
  ]);
  if (accountsResult.error || clientsResult.error) {
    console.error("[meta/accounts/hide] Falha ao ler contas:", accountsResult.error?.message ?? clientsResult.error?.message);
    return NextResponse.json({ error: "Erro ao ler as contas." }, { status: 500 });
  }

  const accounts = accountsResult.data ?? [];
  if (accounts.length !== accountIds.length) {
    return NextResponse.json({ error: "Conta não encontrada nesta organização.", code: "account_not_found" }, { status: 404 });
  }

  const clientNames = new Map((clientsResult.data ?? []).map((client) => [client.id, client.name]));
  const linked = accounts
    .filter((account) => account.client_id && clientNames.has(account.client_id))
    .map((account) => ({
      id: account.id,
      name: account.name || account.external_id,
      clientName: clientNames.get(account.client_id!) ?? null,
    }));
  if (linked.length > 0 && !parsed.data.force) {
    return NextResponse.json(
      {
        error: "Algumas contas estão ligadas a clientes. Confirme para tirá-las do painel mesmo assim.",
        code: "linked_to_client",
        linked,
      },
      { status: 409 },
    );
  }

  const { error } = await session.supabase
    .from("ad_accounts")
    .update({ status: HIDDEN_ACCOUNT_STATUS })
    .eq("org_id", session.orgId)
    .eq("platform", "meta")
    .in("id", accountIds);
  if (error) {
    console.error("[meta/accounts/hide] Falha ao ocultar contas:", error.message);
    return NextResponse.json({ error: "Não foi possível remover as contas do painel." }, { status: 500 });
  }

  return NextResponse.json({ data: { hidden: accountIds.length } });
}
