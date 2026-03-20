import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schema para criação de template
const CreateTemplateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  description: z.string().max(500, "Descrição muito longa").optional(),
  message_template: z.string().optional(),
  metrics: z.array(z.string()).optional().default([]),
  is_default: z.boolean().optional().default(false),
});

// GET - Listar templates da organização
export async function GET() {
  try {
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

    const { data: templates, error } = await supabase
      .from("report_templates")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error("Erro ao listar templates:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// POST - Criar novo template
export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const validatedData = CreateTemplateSchema.parse(body);

    const { data: template, error } = await supabase
      .from("report_templates")
      .insert({
        org_id: profile.org_id,
        name: validatedData.name,
        description: validatedData.description,
        message_template: validatedData.message_template,
        metrics: validatedData.metrics,
        is_default: validatedData.is_default,
        layout: {}, // layout é obrigatório no schema atual
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erro ao criar template:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
