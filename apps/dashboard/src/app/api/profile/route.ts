import { getDashboardSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Schema de validação Zod para os campos permitidos
const profileUpdateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  phone: z.string().min(10, "Telefone inválido").optional().or(z.literal("")),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF em formato inválido").optional().or(z.literal("")),
  country: z.string().optional(),
  language: z.enum(["pt-BR", "en-US", "es"]).optional(),
  timezone: z.string().optional(),
  avatar_url: z.string().url("URL de avatar inválida").optional().or(z.literal("")),
});

export async function GET() {
  try {
    const session = await getDashboardSession();
    if (!session.isAuthorized) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = session.supabase;
    const user = session.user;

    if (!user || session.isPainel) {
      return NextResponse.json({
        data: {
          id: user?.id ?? "painel-admin",
          name: "Evandro",
          email: user?.email ?? "admin@startmetric.com",
          role: "admin",
          timezone: "America/Sao_Paulo",
          language: "pt-BR",
          country: "BR",
        },
      });
    }

    // Busca os dados do perfil estendido do usuário
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, phone, cpf, country, language, timezone, avatar_url, role, org_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: "Erro ao buscar perfil", details: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        ...profile,
        email: user.email, // Injetando e-mail da auth para facilidade no client
      },
    });
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getDashboardSession();
    if (!session.isAuthorized) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = session.supabase;
    const user = session.user;
    const body = await request.json();
    const validatedData = profileUpdateSchema.parse(body);

    if (!user || session.isPainel) {
      return NextResponse.json({
        data: {
          id: user?.id ?? "painel-admin",
          name: validatedData.name ?? "Evandro",
          email: user?.email ?? "admin@startmetric.com",
          ...validatedData,
        },
      });
    }

    // Atualiza apenas os campos passados do perfil referente ao auth.uid()
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(validatedData)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Falha ao atualizar perfil", details: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ data: updatedProfile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("PATCH /api/profile error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}