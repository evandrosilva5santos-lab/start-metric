// app/api/profile/route.ts
// API para buscar e atualizar o perfil do usuário autenticado

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema de validação para atualização de perfil (partial)
const ProfileUpdateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 caracteres").optional().or(z.literal("")),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido. Use o formato: 000.000.000-00").optional().or(z.literal("")),
  country: z.string().length(2, "Código do país deve ter 2 caracteres").optional(),
  language: z.enum(["pt-BR", "en-US", "es"], { message: "Idioma inválido" }).optional(),
  timezone: z.string().min(1, "Fuso horário é obrigatório").optional(),
  avatar_url: z.string().url("URL de avatar inválida").optional(),
});

// GET /api/profile - Retorna o perfil do usuário autenticado
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401 }
    );
  }

  // Buscar perfil com JOIN para pegar email do auth.users
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      id,
      name,
      phone,
      cpf,
      country,
      language,
      timezone,
      avatar_url,
      role,
      org_id,
      created_at,
      updated_at
    `)
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[api/profile] Erro ao buscar perfil:", error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil" },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      { error: "Perfil não encontrado" },
      { status: 404 }
    );
  }

  // Adicionar email do usuário (vem do auth.users)
  const response = {
    data: {
      ...profile,
      email: user.email,
    },
  };

  return NextResponse.json(response);
}

// PATCH /api/profile - Atualiza o perfil do usuário autenticado
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Validar dados com Zod
    const validationResult = ProfileUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      return NextResponse.json(
        { error: "Dados inválidos", details: errors },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Atualizar apenas o próprio perfil (garantido pelo WHERE id = auth.uid())
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select(`
        id,
        name,
        phone,
        cpf,
        country,
        language,
        timezone,
        avatar_url,
        role,
        org_id,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error("[api/profile] Erro ao atualizar perfil:", error);

      // Verificar se é erro de CPF duplicado
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "CPF já cadastrado para outro usuário" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Erro ao atualizar perfil" },
        { status: 500 }
      );
    }

    if (!updatedProfile) {
      return NextResponse.json(
        { error: "Perfil não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        ...updatedProfile,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[api/profile] Erro inesperado:", error);
    return NextResponse.json(
      { error: "Erro inesperado ao processar requisição" },
      { status: 500 }
    );
  }
}
