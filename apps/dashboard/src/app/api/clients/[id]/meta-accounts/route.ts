import { NextRequest, NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { buildAccountGroups, HIDDEN_ACCOUNT_STATUS } from "@/lib/meta/account-groups";
import { discoverOrgAccounts, discoveryFailureResponse, loadPanelAccounts, toPanelStates } from "@/lib/meta/discovery";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const DISCOVER_LIMIT = { limit: 30, windowMs: 5 * 60 * 1000 };

// Contas que a conexão Meta da organização enxerga, agrupadas por gerenciador e marcando a quem cada uma pertence.
export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supabase = session.supabase;
  const orgId = session.orgId;

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .is("archived_at", null)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const limited = rateLimit(`meta-discover:${orgId}`, DISCOVER_LIMIT);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Muitas buscas seguidas. Aguarde um pouco e tente de novo.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  const discovery = await discoverOrgAccounts(supabase, orgId, req.nextUrl.searchParams.get("fresh") === "true");
  if (!discovery.ok) return discoveryFailureResponse(discovery.code);

  let panel;
  try {
    panel = await loadPanelAccounts(supabase, orgId);
  } catch (err) {
    console.error("[clients/meta-accounts] Falha ao ler contas do painel:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erro ao carregar as contas." }, { status: 500 });
  }
  const panelById = new Map(panel.map((row) => [row.externalId, row]));

  const contas = discovery.accounts
    .map((acc) => {
      const row = panelById.get(acc.id);
      return {
        id: acc.id,
        name: acc.name || acc.id,
        currency: acc.currency || "BRL",
        isActive: acc.account_status === undefined || acc.account_status === 1,
        clientId: row?.clientId ?? null,
        clientName: row?.clientName ?? null,
        hidden: row?.status === HIDDEN_ACCOUNT_STATUS,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const grupos = buildAccountGroups(discovery.accounts, toPanelStates(panel));
  return NextResponse.json({ contas, grupos, total: contas.length });
}
