import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schema para atualização de template (partial)
const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  message_template: z.string().optional().nullable(),
  metrics: z.array(z.string()).optional(),
  is_default: z.boolean().optional(),
});

type Params = Promise<{ id: string }>;

// GET - Detalhes do template
export async function GET(
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

    const { data: template, error } = await supabase
      .from("report_templates")
      .select("*")
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error("Erro ao buscar template:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// PATCH - Editar template
export async function PATCH(
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

    // Verificar se o template pertence à org
    const { data: existingTemplate } = await supabase
      .from("report_templates")
      .select("id")
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .single();

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = UpdateTemplateSchema.parse(body);

    const { data: template, error } = await supabase
      .from("report_templates")
      .update(validatedData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erro ao atualizar template:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// DELETE - Deletar template
export async function DELETE(
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

    // Verificar se o template pertence à org
    const { data: existingTemplate } = await supabase
      .from("report_templates")
      .select("id")
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .single();

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    }

    // TODO: Verificar se há scheduled_reports usando este template quando a tabela existir
    const { error } = await supabase
      .from("report_templates")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar template:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
