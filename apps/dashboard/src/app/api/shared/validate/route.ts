import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";

// Schema para validação
const ValidateTokenSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar request
    const parsed = ValidateTokenSchema.parse(body);
    const { token, password } = parsed;

    // Criar cliente Supabase
    const supabase = await createClient();

    // 1. Buscar link compartilhado
    const { data: sharedLink, error: selectError } = await supabase
      .from("shared_links")
      .select(`
        id,
        client_id,
        org_id,
        access_type,
        expires_at,
        password_hash,
        max_accesses,
        access_count,
        revoked_at,
        metadata,
        clients!shared_links_client_id_fkey(
          id,
          name,
          org_id
        ),
        organizations!shared_links_org_id_fkey(
          id,
          name
        )
      `)
      .eq("token", token)
      .single();

    if (selectError || !sharedLink) {
      return NextResponse.json(
        { error: "Link compartilhado não encontrado ou inválido" },
        { status: 404 }
      );
    }

    // 2. Verificar se foi revogado
    if (sharedLink.revoked_at) {
      return NextResponse.json(
        { error: "Link compartilhado foi revogado" },
        { status: 403 }
      );
    }

    // 3. Verificar expiração
    const now = new Date();
    const expiresAt = new Date(sharedLink.expires_at);

    if (now > expiresAt) {
      return NextResponse.json(
        { error: "Link compartilhado expirou" },
        { status: 410 }
      );
    }

    // 4. Verificar limite de acessos
    if (sharedLink.max_accesses && sharedLink.access_count >= sharedLink.max_accesses) {
      return NextResponse.json(
        { error: "Limite de acessos atingido" },
        { status: 403 }
      );
    }

    // 5. Verificar senha (se existir)
    if (sharedLink.password_hash) {
      if (!password) {
        return NextResponse.json(
          { error: "Senha requerida" },
          { status: 403 }
        );
      }

      const passwordValid = await bcrypt.compare(password, sharedLink.password_hash);
      if (!passwordValid) {
        return NextResponse.json(
          { error: "Senha incorreta" },
          { status: 403 }
        );
      }
    }

    // 6. Atualizar access_count e last_accessed_at
    const { error: updateError } = await supabase
      .from("shared_links")
      .update({
        access_count: sharedLink.access_count + 1,
        last_accessed_at: now.toISOString(),
      })
      .eq("id", sharedLink.id);

    if (updateError) {
      console.error("Erro ao atualizar access_count:", updateError);
      // Não retornar erro aqui, apenas log
    }

    // 7. Retornar informações do link validado
    return NextResponse.json(
      {
        success: true,
        data: {
          id: sharedLink.id,
          client_id: sharedLink.client_id,
          client_name: (sharedLink.clients as { name?: string } | null)?.name || "Cliente",
          org_id: sharedLink.org_id,
          org_name: (sharedLink.organizations as { name?: string } | null)?.name || "Organização",
          access_type: sharedLink.access_type,
          valid: true,
          access_count: sharedLink.access_count + 1,
          max_accesses: sharedLink.max_accesses,
          expires_at: sharedLink.expires_at,
          metadata: sharedLink.metadata,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validação falhou",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("Erro ao validar token:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
