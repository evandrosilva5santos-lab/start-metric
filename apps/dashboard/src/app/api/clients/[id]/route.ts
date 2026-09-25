import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateClientSchema } from "@/lib/clients/schema";

type Params = Promise<{ id: string }>;

export async function GET(
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

    // Buscar cliente com ad_accounts associadas
    const { data: client, error } = await supabase
      .from("clients")
      .select(`
        id,
        name,
        email,
        phone,
        whatsapp,
        niche,
        logo_url,
        notes,
        archived_at,
        created_at,
        updated_at,
        ad_accounts(id, name, external_id, platform, status)
      `)
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: client });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await request.json();
    const validatedData = updateClientSchema.parse(body);

    // Só os campos enviados; string vazia chega aqui como null e limpa o campo.
    const updateData = Object.fromEntries(
      Object.entries(validatedData).filter(([, value]) => value !== undefined),
    ) as z.infer<typeof updateClientSchema>;

    const { data: client, error } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .select()
      .single();

    if (error || !client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: client });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(
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

    // Soft delete: arquivar cliente
    const { data: client, error } = await supabase
      .from("clients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .select()
      .single();

    if (error || !client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Contas de cliente arquivado voltam para "Sem cliente" no seletor.
    await supabase
      .from("ad_accounts")
      .update({ client_id: null })
      .eq("org_id", profile.org_id)
      .eq("client_id", id);

    return NextResponse.json({ data: { id, archived: true } });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
