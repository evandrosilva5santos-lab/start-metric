import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const associateAccountSchema = z.object({
  account_id: z.string().uuid("ID de conta inválido"),
});

type Params = Promise<{ id: string }>;

// POST: Associar ad_account ao cliente
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // Verificar se o cliente existe
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", id)
      .eq("org_id", profile.org_id)
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
      .eq("org_id", profile.org_id)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Conta de anúncio não encontrada" }, { status: 404 });
    }

    // Associar conta ao cliente
    const { error: updateError } = await supabase
      .from("ad_accounts")
      .update({ client_id: id })
      .eq("id", account_id)
      .eq("org_id", profile.org_id);

    if (updateError) {
      console.error("Erro ao associar conta:", updateError);
      return NextResponse.json({ error: "Erro ao associar conta" }, { status: 500 });
    }

    return NextResponse.json({ data: { success: true, account_id, client_id: id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
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

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // Verificar se o cliente existe
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    let query = supabase
      .from("ad_accounts")
      .update({ client_id: null })
      .eq("org_id", profile.org_id);

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
