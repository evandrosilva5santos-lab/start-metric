import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildVariables, renderTemplate } from "@start-metric/reports";

// Schema para preview
const PreviewSchema = z.object({
  client_id: z.string().min(1, "client_id é obrigatório"),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

type Params = Promise<{ id: string }>;

// POST - Preview do template com dados reais
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

    // Buscar template
    const { data: template, error: templateError } = await supabase
      .from("report_templates")
      .select("*")
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
    }

    // Validar body da requisição
    const body = await request.json();
    const { client_id, date_from, date_to } = PreviewSchema.parse(body);

    // Verificar se o cliente pertence à org
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", client_id)
      .eq("org_id", profile.org_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Definir período padrão (últimos 7 dias)
    const toDate = date_to ? new Date(date_to) : new Date();
    const fromDate = date_from ? new Date(date_from) : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const dateRange = {
      from: fromDate.toISOString().split('T')[0],
      to: toDate.toISOString().split('T')[0],
    };

    // Construir variáveis com dados reais
    const variables = await buildVariables(supabase, {
      orgId: profile.org_id,
      clientId: client_id,
      dateRange,
    });

    // Renderizar template
    const { rendered, warnings } = renderTemplate(
      template.message_template || "",
      variables
    );

    return NextResponse.json({
      data: {
        rendered,
        warnings,
        variables,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erro ao gerar preview:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
