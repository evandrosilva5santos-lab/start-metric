import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createEvolutionClient } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const testMessageSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(8, "Telefone inválido")
    .max(20, "Telefone inválido")
    .regex(/^\+?[0-9]+$/, "Use apenas dígitos e opcional +")
    .optional(),
});

async function getAuthenticatedOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, orgId: null, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.org_id) {
    return {
      supabase,
      orgId: null,
      response: NextResponse.json({ error: "Organização não encontrada" }, { status: 404 }),
    };
  }

  return { supabase, orgId: profile.org_id, response: null };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const { supabase, orgId, response } = await getAuthenticatedOrgId();
  if (!orgId) return response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = testMessageSchema.parse(body);

    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, org_id, instance_name, phone_number, status")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: "Instância WhatsApp não encontrada" }, { status: 404 });
    }

    if (instance.status !== "connected") {
      return NextResponse.json(
        { error: "A instância precisa estar conectada para enviar teste" },
        { status: 400 },
      );
    }

    const phone = parsed.phone ?? instance.phone_number ?? "";
    if (!phone) {
      return NextResponse.json(
        { error: "Informe um telefone para enviar a mensagem de teste" },
        { status: 400 },
      );
    }

    const evolution = createEvolutionClient();
    const sendResult = await evolution.sendText(
      instance.instance_name,
      phone,
      "✅ Teste de conexão — Start Metric",
    );

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error ?? "Falha ao enviar mensagem de teste" },
        { status: 502 },
      );
    }

    if (phone !== instance.phone_number) {
      await supabase
        .from("whatsapp_instances")
        .update({ phone_number: phone })
        .eq("id", instance.id)
        .eq("org_id", orgId);
    }

    return NextResponse.json({
      data: {
        sent: true,
        message_id: sendResult.messageId ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }

    console.error("Erro ao enviar mensagem de teste:", error);
    return NextResponse.json({ error: "Erro interno ao enviar mensagem de teste" }, { status: 500 });
  }
}

