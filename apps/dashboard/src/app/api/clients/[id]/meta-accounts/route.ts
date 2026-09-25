import { NextRequest, NextResponse } from "next/server";
import { getOrgMetaToken, listOrgMetaAccounts } from "@/lib/meta/org-token";
import { MetaApiError } from "@/lib/meta/client";
import { getDashboardSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// Contas que a conexão Meta da organização enxerga, marcando a quem cada uma já pertence.
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
    .is("archived_at", null)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const orgToken = await getOrgMetaToken(supabase, orgId);
  if (!orgToken) {
    return NextResponse.json(
      { error: "Conecte a Meta da sua organização em Configurações > Meta para buscar as contas.", code: "meta_not_connected" },
      { status: 409 },
    );
  }

  let metaAccounts;
  try {
    metaAccounts = await listOrgMetaAccounts(orgId, orgToken.token, req.nextUrl.searchParams.get("fresh") === "true");
  } catch (err) {
    const expired = err instanceof MetaApiError && err.code === 190;
    return NextResponse.json(
      {
        error: expired
          ? "A conexão com a Meta expirou. Conecte de novo em Configurações > Meta."
          : "A Meta não respondeu agora. Tente de novo em alguns minutos.",
        code: expired ? "meta_token_expired" : "meta_unavailable",
      },
      { status: 502 },
    );
  }

  const [linkedRes, clientsRes] = await Promise.all([
    supabase.from("ad_accounts").select("external_id, client_id").eq("org_id", orgId).eq("platform", "meta"),
    supabase.from("clients").select("id, name").eq("org_id", orgId),
  ]);
  const clientName = new Map((clientsRes.data ?? []).map((c: any) => [c.id, c.name]));
  const owner = new Map((linkedRes.data ?? []).map((a: any) => [a.external_id, a.client_id]));

  const contas = metaAccounts
    .map((acc) => {
      const ownerId = owner.get(acc.id) ?? null;
      return {
        id: acc.id,
        name: acc.name || acc.id,
        currency: acc.currency || "BRL",
        isActive: acc.account_status === undefined || acc.account_status === 1,
        clientId: ownerId,
        clientName: ownerId ? (clientName.get(ownerId) ?? null) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return NextResponse.json({ contas, total: contas.length });
}
