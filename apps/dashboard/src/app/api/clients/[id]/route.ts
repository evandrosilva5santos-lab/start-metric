import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateClientSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  logo_url: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
});

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

    // Construir objeto de update apenas com campos fornecidos
    const updateData: Partial<z.infer<typeof updateClientSchema>> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.email !== undefined) updateData.email = validatedData.email || undefined;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone || undefined;
    if (validatedData.whatsapp !== undefined) updateData.whatsapp = validatedData.whatsapp || undefined;
    if (validatedData.logo_url !== undefined) updateData.logo_url = validatedData.logo_url || undefined;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes || undefined;

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

    return NextResponse.json({ data: { id, archived: true } });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
