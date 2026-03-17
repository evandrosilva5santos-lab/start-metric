import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createEvolutionClient, EvolutionApiError } from "@/lib/whatsapp/evolution";
import type { Tables } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createInstanceSchema = z.object({
  client_id: z.string().uuid("client_id inválido"),
});

type InstanceRow = Tables<"whatsapp_instances"> & {
  clients?: { id: string; name: string } | { id: string; name: string }[] | null;
};

function getClientName(clientData: InstanceRow["clients"]): string | null {
  if (!clientData) return null;
  if (Array.isArray(clientData)) return clientData[0]?.name ?? null;
  return clientData.name;
}

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

export async function GET(request: NextRequest) {
  const { supabase, orgId, response } = await getAuthenticatedOrgId();
  if (!orgId) return response;

  const clientIdFilter = request.nextUrl.searchParams.get("client_id");

  let query = supabase
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
      updated_at,
      clients(id, name)
    `)
    .eq("org_id", orgId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (clientIdFilter) {
    query = query.eq("client_id", clientIdFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao listar instâncias do WhatsApp:", error);
    return NextResponse.json({ error: "Erro ao listar instâncias WhatsApp" }, { status: 500 });
  }

  const formatted = (data as InstanceRow[] | null)?.map((instance) => ({
    id: instance.id,
    client_id: instance.client_id,
    client_name: getClientName(instance.clients),
    instance_name: instance.instance_name,
    phone_number: instance.phone_number,
    status: instance.status,
    qr_code: instance.qr_code,
    last_connected_at: instance.last_connected_at,
    created_at: instance.created_at,
    updated_at: instance.updated_at,
  })) ?? [];

  return NextResponse.json({ data: formatted });
}

export async function POST(request: NextRequest) {
  const { supabase, orgId, response } = await getAuthenticatedOrgId();
  if (!orgId) return response;

  try {
    const body = await request.json();
    const parsed = createInstanceSchema.parse(body);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", parsed.client_id)
      .eq("org_id", orgId)
      .is("archived_at", null)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const instanceName = `org-${orgId.slice(0, 8)}-client-${client.id.slice(0, 8)}-${Date.now()}`;
    const evolution = createEvolutionClient();

    const createResponse = await evolution.createInstance(instanceName);
    let qrCode = createResponse.qrcode?.base64 ?? null;

    if (!qrCode) {
      const qrResponse = await evolution.getQRCode(instanceName);
      qrCode = qrResponse.base64 ?? null;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("whatsapp_instances")
      .insert({
        org_id: orgId,
        client_id: client.id,
        instance_name: instanceName,
        api_url: process.env.EVOLUTION_API_URL ?? null,
        api_key: null,
        status: "connecting",
        qr_code: qrCode,
      })
      .select(`
        id,
        client_id,
        instance_name,
        phone_number,
        status,
        qr_code,
        last_connected_at,
        created_at,
        updated_at,
        clients(id, name)
      `)
      .single();

    if (insertError || !inserted) {
      console.error("Erro ao salvar instância no banco:", insertError);
      try {
        await evolution.deleteInstance(instanceName);
      } catch (rollbackError) {
        console.error("Falha no rollback da instância Evolution:", rollbackError);
      }
      return NextResponse.json({ error: "Erro ao salvar instância WhatsApp" }, { status: 500 });
    }

    const formatted = inserted as InstanceRow;

    return NextResponse.json(
      {
        data: {
          id: formatted.id,
          client_id: formatted.client_id,
          client_name: getClientName(formatted.clients),
          instance_name: formatted.instance_name,
          phone_number: formatted.phone_number,
          status: formatted.status,
          qr_code: formatted.qr_code,
          last_connected_at: formatted.last_connected_at,
          created_at: formatted.created_at,
          updated_at: formatted.updated_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }

    if (error instanceof EvolutionApiError) {
      return NextResponse.json(
        { error: `Evolution API: ${error.message}` },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }

    console.error("Erro ao criar instância WhatsApp:", error);
    return NextResponse.json({ error: "Erro interno ao criar instância WhatsApp" }, { status: 500 });
  }
}
