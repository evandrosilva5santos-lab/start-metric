import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

// POST - Duplicar template
export async function POST(
  request: Request,
  { params }: { params: Params }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
    }

    // Buscar template original
    const { data: originalTemplate, error: fetchError } = await supabase
      .from("report_templates")
      .select("*")
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .single();

    if (fetchError || !originalTemplate) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    }

    // Criar cópia
    const { data: duplicatedTemplate, error: insertError } = await supabase
      .from("report_templates")
      .insert({
        org_id: profile.org_id,
        name: `${originalTemplate.name} (cópia)`,
        description: originalTemplate.description,
        message_template: originalTemplate.message_template,
        metrics: originalTemplate.metrics,
        is_default: false, // Cópia nunca é default
        layout: originalTemplate.layout, // Preservar layout
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: duplicatedTemplate }, { status: 201 });
  } catch (error) {
    console.error("Erro ao duplicar template:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
