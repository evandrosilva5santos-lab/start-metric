import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { partitionRequestedIds } from "@/lib/meta/account-groups";
import { discoverOrgAccounts, discoveryFailureResponse } from "@/lib/meta/discovery";

export const dynamic = "force-dynamic";

const SELECT_LIMIT = { limit: 30, windowMs: 5 * 60 * 1000 };

const selectSchema = z.object({
  externalIds: z.array(z.string().regex(/^act_[0-9]+$/, "Conta inválida")).min(1).max(500),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const limited = rateLimit(`meta-select:${session.orgId}`, SELECT_LIMIT);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Muitas alterações seguidas. Aguarde um pouco e tente de novo.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const parsed = selectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });
  }

  const discovery = await discoverOrgAccounts(session.supabase, session.orgId);
  if (!discovery.ok) return discoveryFailureResponse(discovery.code);

  const byId = new Map(discovery.accounts.map((account) => [account.id, account]));
  const { valid, unknown } = partitionRequestedIds(parsed.data.externalIds, byId.keys());
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: "Algumas contas não pertencem à sua conexão Meta.", code: "unknown_accounts", unknown },
      { status: 403 },
    );
  }

  const rows = valid.map((externalId) => {
    const account = byId.get(externalId)!;
    return {
      org_id: session.orgId,
      platform: "meta",
      external_id: externalId,
      name: account.name || externalId,
      currency: account.currency || "BRL",
      timezone: account.timezone_name || "America/Sao_Paulo",
      token_encrypted: discovery.token.tokenEncrypted,
      token_expires_at: discovery.token.tokenExpiresAt,
      status: "active",
    };
  });

  const { error } = await session.supabase.from("ad_accounts").upsert(rows, { onConflict: "org_id,external_id" });
  if (error) {
    console.error("[meta/accounts/select] Falha ao salvar contas:", error.message);
    return NextResponse.json({ error: "Não foi possível adicionar as contas ao painel." }, { status: 500 });
  }

  return NextResponse.json({ data: { added: rows.length } });
}
