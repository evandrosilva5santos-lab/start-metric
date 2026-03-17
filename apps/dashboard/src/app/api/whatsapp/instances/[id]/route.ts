import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEvolutionClient, EvolutionApiError } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

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

export async function GET(
  _request: Request,
  { params }: { params: Params },
) {
  const { id } = await params;
  const { supabase, orgId, response } = await getAuthenticatedOrgId();
  if (!orgId) return response;

  const { data: instance, error } = await supabase
    .from("whatsapp_instances")
    .select(`
      id,
      client_id,
      instance_name,
      phone_number,
      status,
      qr_code,
      last_connected_at,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !instance) {
    return NextResponse.json({ error: "Instância WhatsApp não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ data: instance });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Params },
) {
  const { id } = await params;
  const { supabase, orgId, response } = await getAuthenticatedOrgId();
  if (!orgId) return response;

  const { data: instance, error: instanceError } = await supabase
    .from("whatsapp_instances")
    .select("id, org_id, instance_name")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (instanceError || !instance) {
    return NextResponse.json({ error: "Instância WhatsApp não encontrada" }, { status: 404 });
  }

  try {
    const evolution = createEvolutionClient();
    await evolution.deleteInstance(instance.instance_name);
  } catch (error) {
    if (error instanceof EvolutionApiError) {
      console.error("Falha ao deletar instância na Evolution:", error.message);
    } else {
      console.error("Falha inesperada ao deletar instância na Evolution:", error);
    }
    // Mantemos fluxo de soft delete local para não bloquear o usuário.
  }

  const { error: updateError } = await supabase
    .from("whatsapp_instances")
    .update({
      status: "deleted",
      qr_code: null,
      phone_number: null,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (updateError) {
    console.error("Erro ao marcar instância como deletada:", updateError);
    return NextResponse.json({ error: "Erro ao remover instância WhatsApp" }, { status: 500 });
  }

  return NextResponse.json({ data: { deleted: true } });
}

