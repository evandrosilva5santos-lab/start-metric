import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrgMetaToken, listOrgMetaAccounts } from "@/lib/meta/org-token";
import { getDashboardSession, type DashboardSession } from "@/lib/auth/session";

const associateAccountSchema = z.object({
  account_id: z.string().uuid("ID de conta inválido"),
  confirm_reassignment: z.boolean().default(false),
});

const setAccountsSchema = z.object({
  external_ids: z.array(z.string().regex(/^act_[0-9]+$/, "Conta inválida")).max(1000),
  confirm_reassignment: z.boolean().default(false),
});

type Params = Promise<{ id: string }>;
type AuthorizedSession = Extract<DashboardSession, { isAuthorized: true }>;

async function activeClientExists(session: AuthorizedSession, clientId: string): Promise<boolean> {
  const { data } = await session.supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("org_id", session.orgId)
    .is("archived_at", null)
    .maybeSingle();
  return Boolean(data);
}

function assignmentError(error: { message: string }): NextResponse {
  if (error.message.includes("ACCOUNT_REASSIGNMENT_CONFIRMATION_REQUIRED")) {
    const conflictList = error.message.split("ACCOUNT_REASSIGNMENT_CONFIRMATION_REQUIRED:")[1]?.split(/\s/)[0] ?? "";
    return NextResponse.json(
      {
        error: "Uma ou mais contas já pertencem a outro cliente. Confirme a reatribuição para continuar.",
        code: "reassignment_confirmation_required",
        conflicts: conflictList ? conflictList.split(",") : [],
      },
      { status: 409 },
    );
  }
  if (error.message.includes("CLIENT_NOT_FOUND") || error.message.includes("ACCOUNT_NOT_FOUND_IN_ORG")) {
    return NextResponse.json({ error: "Cliente ou conta não encontrado nesta organização." }, { status: 404 });
  }
  console.error("[clients/accounts] Falha na atribuição transacional:", error.message);
  return NextResponse.json({ error: "Não foi possível atualizar os vínculos." }, { status: 500 });
}

async function assignSet(
  session: AuthorizedSession,
  clientId: string,
  externalIds: string[],
  confirmReassignment: boolean,
): Promise<NextResponse> {
  const { data, error } = await session.supabase.rpc("set_client_ad_accounts", {
    p_org_id: session.orgId,
    p_client_id: clientId,
    p_platform: "meta",
    p_external_ids: externalIds,
    p_confirm_reassignment: confirmReassignment,
  });
  if (error) return assignmentError(error);
  const result = data?.[0];
  return NextResponse.json({
    data: {
      client_id: clientId,
      linked: result?.linked_count ?? 0,
      unlinked: result?.unlinked_count ?? 0,
      reassigned: result?.reassigned_count ?? 0,
    },
  });
}

// Define o conjunto completo do cliente. A RPC serializa e confirma reatribuições.
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!(await activeClientExists(session, id))) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const parsed = setAccountsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });
  }
  const externalIds = [...new Set(parsed.data.external_ids)];

  if (externalIds.length > 0) {
    const orgToken = await getOrgMetaToken(session.supabase, session.orgId);
    if (!orgToken) {
      return NextResponse.json(
        { error: "Conecte a Meta da sua organização em Configurações > Meta.", code: "meta_not_connected" },
        { status: 409 },
      );
    }

    let visible;
    try {
      visible = await listOrgMetaAccounts(session.orgId, orgToken.token);
    } catch {
      return NextResponse.json({ error: "A Meta não respondeu agora. Tente de novo." }, { status: 502 });
    }

    const byId = new Map(visible.map((account) => [account.id, account]));
    const unknown = externalIds.filter((externalId) => !byId.has(externalId));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: "Algumas contas não pertencem à sua conexão Meta.", unknown },
        { status: 403 },
      );
    }

    const discoveredRows = externalIds.map((externalId) => {
      const account = byId.get(externalId)!;
      return {
        org_id: session.orgId,
        platform: "meta",
        external_id: externalId,
        name: account.name || externalId,
        currency: account.currency || "BRL",
        timezone: account.timezone_name || "America/Sao_Paulo",
        token_encrypted: orgToken.tokenEncrypted,
        token_expires_at: orgToken.tokenExpiresAt,
        status: "active",
      };
    });

    const { error } = await session.supabase.from("ad_accounts").upsert(discoveredRows, {
      onConflict: "org_id,platform,external_id",
      ignoreDuplicates: true,
    });
    if (error) {
      console.error("[clients/accounts] Falha ao registrar contas descobertas:", error.message);
      return NextResponse.json({ error: "Erro ao registrar contas descobertas." }, { status: 500 });
    }
  }

  return assignSet(session, id, externalIds, parsed.data.confirm_reassignment);
}

// Associa uma conta já descoberta sem remover as demais contas do cliente.
export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!(await activeClientExists(session, id))) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const parsed = associateAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });
  }

  const [{ data: account }, { data: current }] = await Promise.all([
    session.supabase
      .from("ad_accounts")
      .select("external_id")
      .eq("id", parsed.data.account_id)
      .eq("org_id", session.orgId)
      .eq("platform", "meta")
      .maybeSingle(),
    session.supabase
      .from("ad_accounts")
      .select("external_id")
      .eq("org_id", session.orgId)
      .eq("platform", "meta")
      .eq("client_id", id),
  ]);
  if (!account) {
    return NextResponse.json({ error: "Conta de anúncio não encontrada" }, { status: 404 });
  }

  const ids = [...new Set([...(current ?? []).map((row) => row.external_id), account.external_id])];
  return assignSet(session, id, ids, parsed.data.confirm_reassignment);
}

// Desvincula imediatamente uma conta específica ou todo o conjunto do cliente.
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!(await activeClientExists(session, id))) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const accountId = request.nextUrl.searchParams.get("account_id");
  let query = session.supabase
    .from("ad_accounts")
    .update({ client_id: null })
    .eq("org_id", session.orgId)
    .eq("client_id", id);
  if (accountId) query = query.eq("id", accountId);
  const { error } = await query;
  if (error) {
    console.error("[clients/accounts] Falha ao desvincular:", error.message);
    return NextResponse.json({ error: "Erro ao desvincular conta(s)." }, { status: 500 });
  }
  return NextResponse.json({ data: { success: true, disassociated: accountId ? "specific" : "all" } });
}
