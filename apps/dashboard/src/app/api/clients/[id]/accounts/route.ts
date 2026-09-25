import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrgMetaToken, listOrgMetaAccounts } from "@/lib/meta/org-token";
import { getDashboardSession } from "@/lib/auth/session";

const associateAccountSchema = z.object({
  account_id: z.string().uuid("ID de conta inválido"),
});

const setAccountsSchema = z.object({
  external_ids: z.array(z.string().regex(/^act_[0-9]+$/, "Conta inválida")).max(1000),
});

type Params = Promise<{ id: string }>;

// PUT: define o conjunto de contas do cliente (liga as marcadas, solta as desmarcadas).
// Uma conta que era de outro cliente passa para este.
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
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

  let externalIds: string[];
  try {
    externalIds = [...new Set(setAccountsSchema.parse(await request.json()).external_ids)];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (externalIds.length > 0) {
    const orgToken = await getOrgMetaToken(supabase, orgId);
    if (!orgToken) {
      return NextResponse.json(
        { error: "Conecte a Meta da sua organização em Configurações > Meta.", code: "meta_not_connected" },
        { status: 409 },
      );
    }

    let visible;
    try {
      visible = await listOrgMetaAccounts(orgId, orgToken.token);
    } catch {
      return NextResponse.json({ error: "A Meta não respondeu agora. Tente de novo." }, { status: 502 });
    }
    // Só contas que a conexão da própria organização enxerga.
    const byId = new Map(visible.map((acc) => [acc.id, acc]));
    const unknown = externalIds.filter((extId) => !byId.has(extId));
    if (unknown.length > 0) {
      return NextResponse.json({ error: "Algumas contas não pertencem à sua conexão Meta.", unknown }, { status: 403 });
    }

    const rows = externalIds.map((extId) => {
      const acc = byId.get(extId)!;
      return {
        org_id: orgId,
        platform: "meta",
        external_id: extId,
        name: acc.name || extId,
        currency: acc.currency || "BRL",
        timezone: acc.timezone_name || "America/Sao_Paulo",
        token_encrypted: orgToken.tokenEncrypted,
        token_expires_at: orgToken.tokenExpiresAt,
        status: "active",
        client_id: id,
      };
    });

    const { error: upsertError } = await supabase.from("ad_accounts").upsert(rows, { onConflict: "org_id,external_id" });
    if (upsertError) {
      console.error("[clients/accounts] Erro ao ligar contas:", upsertError);
      return NextResponse.json({ error: "Erro ao ligar as contas" }, { status: 500 });
    }
  }

  let unlink = supabase.from("ad_accounts").update({ client_id: null }).eq("org_id", orgId).eq("client_id", id);
  if (externalIds.length > 0) {
    unlink = unlink.not("external_id", "in", `(${externalIds.join(",")})`);
  }
  const { error: unlinkError } = await unlink;
  if (unlinkError) {
    console.error("[clients/accounts] Erro ao soltar contas:", unlinkError);
    return NextResponse.json({ error: "Erro ao atualizar as contas do cliente" }, { status: 500 });
  }

  return NextResponse.json({ data: { client_id: id, linked: externalIds.length } });
}

// POST: Associar ad_account ao cliente
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    const session = await getDashboardSession();
    if (!session.isAuthorized) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = session.supabase;
    const orgId = session.orgId;

    // Verificar se o cliente existe
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", id)
      .is("archived_at", null)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { account_id } = associateAccountSchema.parse(body);

    // Verificar se a conta pertence à mesma org
    const { data: account, error: accountError } = await supabase
      .from("ad_accounts")
      .select("id")
      .eq("id", account_id)
      .eq("org_id", orgId)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Conta de anúncio não encontrada" }, { status: 404 });
    }

    // Associar conta ao cliente
    const { error: updateError } = await supabase
      .from("ad_accounts")
      .update({ client_id: id })
      .eq("id", account_id)
      .eq("org_id", orgId);

    if (updateError) {
      console.error("Erro ao associar conta:", updateError);
      return NextResponse.json({ error: "Erro ao associar conta" }, { status: 500 });
    }

    return NextResponse.json({ data: { success: true, account_id, client_id: id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// DELETE: Desassociar todas as contas de um cliente (ou passar account_id específico via query)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const accountId = url.searchParams.get("account_id");

    const session = await getDashboardSession();
    if (!session.isAuthorized) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = session.supabase;
    const orgId = session.orgId;

    // Verificar se o cliente existe
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    let query = supabase
      .from("ad_accounts")
      .update({ client_id: null })
      .eq("org_id", orgId);

    if (accountId) {
      // Desassociar conta específica
      query = query.eq("id", accountId).eq("client_id", id);
    } else {
      // Desassociar todas as contas do cliente
      query = query.eq("client_id", id);
    }

    const { error: updateError } = await query;

    if (updateError) {
      console.error("Erro ao desassociar contas:", updateError);
      return NextResponse.json({ error: "Erro ao desassociar contas" }, { status: 500 });
    }

    return NextResponse.json({ data: { success: true, disassociated: accountId ? "specific" : "all" } });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
