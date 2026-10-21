import { NextRequest, NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { buildAccountGroups } from "@/lib/meta/account-groups";
import { discoverOrgAccounts, discoveryFailureResponse, loadPanelAccounts, toPanelStates } from "@/lib/meta/discovery";

export const dynamic = "force-dynamic";

const DISCOVER_LIMIT = { limit: 30, windowMs: 5 * 60 * 1000 };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const limited = rateLimit(`meta-discover:${session.orgId}`, DISCOVER_LIMIT);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Muitas buscas seguidas. Aguarde um pouco e tente de novo.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const discovery = await discoverOrgAccounts(
    session.supabase,
    session.orgId,
    request.nextUrl.searchParams.get("fresh") === "true",
  );
  if (!discovery.ok) return discoveryFailureResponse(discovery.code);

  try {
    const panel = await loadPanelAccounts(session.supabase, session.orgId);
    const groups = buildAccountGroups(discovery.accounts, toPanelStates(panel));
    return NextResponse.json({ groups, total: groups.reduce((sum, group) => sum + group.accounts.length, 0) });
  } catch (err) {
    console.error("[meta/discover] Falha ao montar a lista:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao carregar as contas do painel." }, { status: 500 });
  }
}
