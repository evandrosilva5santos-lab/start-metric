import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcrypt";

// Schema para validação
const GenerateTokenSchema = z.object({
  client_id: z.string().uuid(),
  access_type: z.union([z.literal("dashboard"), z.literal("report")]).default("dashboard"),
  expires_in_days: z.number().min(1).max(365).default(30),
  password: z.string().min(4).optional().or(z.literal("")),
  max_accesses: z.number().int().positive().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

type GenerateTokenRequest = z.infer<typeof GenerateTokenSchema>;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validar request
    const parsed = GenerateTokenSchema.parse(body);
    const { client_id, access_type, expires_in_days, password, max_accesses, metadata } = parsed;

    // Criar cliente Supabase
    const supabase = await createClient();

    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // 2. Buscar org_id do usuário
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.org_id) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // 3. Verificar se cliente existe e pertence à org
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, org_id")
      .eq("id", client_id)
      .eq("org_id", profile.org_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: "Cliente não encontrado ou acesso negado" },
        { status: 404 }
      );
    }

    // 4. Gerar token aleatório (64 caracteres)
    const token = crypto.randomBytes(32).toString("hex");

    // 5. Hash de senha (se fornecida)
    let passwordHash = null;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // 6. Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // 7. Inserir em shared_links
    const { data: sharedLink, error: insertError } = await supabase
      .from("shared_links")
      .insert({
        org_id: profile.org_id,
        client_id: client_id,
        token: token,
        password_hash: passwordHash,
        access_type: access_type,
        expires_at: expiresAt.toISOString(),
        max_accesses: max_accesses || null,
        access_count: 0,
        created_by: user.id,
        metadata: metadata ? (metadata as Record<string, unknown>) : null,
      } as any)
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar shared link:", insertError);
      return NextResponse.json(
        { error: "Erro ao gerar link compartilhado" },
        { status: 500 }
      );
    }

    // 8. Gerar URL compartilhável
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const sharedUrl = `${baseUrl}/shared/${access_type === "report" ? "report" : "dashboard"}/${token}`;

    return NextResponse.json(
      {
        success: true,
        data: {
          id: sharedLink.id,
          token: token,
          url: sharedUrl,
          expires_at: sharedLink.expires_at,
          protected: !!passwordHash,
          max_accesses: max_accesses || null,
          access_type: access_type,
        },
      },
      { status: 201 }
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

    console.error("Erro ao gerar token:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
