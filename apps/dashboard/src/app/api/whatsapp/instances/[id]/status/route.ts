import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createEvolutionClient,
  EvolutionApiError,
  mapEvolutionStateToStatus,
  type WhatsAppInstanceStatus,
} from "@/lib/whatsapp/evolution";
import type { Tables } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const QR_REFRESH_INTERVAL_MS = 55_000;

type Params = Promise<{ id: string }>;
type InstanceRow = Tables<"whatsapp_instances">;

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

function shouldRefreshQr(instance: InstanceRow): boolean {
  if (instance.status === "connected" || instance.status === "deleted") {
    return false;
  }

  if (!instance.qr_code) {
    return true;
  }

  const lastUpdate = new Date(instance.updated_at).getTime();
  if (Number.isNaN(lastUpdate)) {
    return true;
  }

  return Date.now() - lastUpdate >= QR_REFRESH_INTERVAL_MS;
}

export async function GET(
  _request: Request,
  { params }: { params: Params },
) {
  const { id } = await params;
  const { supabase, orgId, response } = await getAuthenticatedOrgId();
  if (!orgId) return response;

  const { data: instance, error: instanceError } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (instanceError || !instance) {
    return NextResponse.json({ error: "Instância WhatsApp não encontrada" }, { status: 404 });
  }

  const evolution = createEvolutionClient();
  let nextStatus = instance.status;
  let nextQrCode = instance.qr_code;
  let lastConnectedAt = instance.last_connected_at;

  try {
    const connection = await evolution.getConnectionState(instance.instance_name);
    const mappedStatus = mapEvolutionStateToStatus(connection.instance.state);
    nextStatus = mappedStatus;

    if (mappedStatus === "connected" && !lastConnectedAt) {
      lastConnectedAt = new Date().toISOString();
    }

    if (mappedStatus !== "connected" && shouldRefreshQr(instance as InstanceRow)) {
      const qrResponse = await evolution.getQRCode(instance.instance_name);
      nextQrCode = qrResponse.base64 ?? nextQrCode;
      nextStatus = "connecting";
    }
  } catch (error) {
    if (error instanceof EvolutionApiError) {
      nextStatus = "error";
    } else {
      console.error("Erro inesperado ao buscar status WhatsApp:", error);
      nextStatus = "error";
    }
  }

  const updatePayload: Partial<InstanceRow> = {};
  if (nextStatus !== instance.status) updatePayload.status = nextStatus as WhatsAppInstanceStatus;
  if (nextQrCode !== instance.qr_code) updatePayload.qr_code = nextQrCode;
  if (lastConnectedAt !== instance.last_connected_at) updatePayload.last_connected_at = lastConnectedAt;

  let finalRecord: InstanceRow = instance as InstanceRow;

  if (Object.keys(updatePayload).length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from("whatsapp_instances")
      .update(updatePayload)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("Erro ao atualizar status da instância WhatsApp:", updateError);
      return NextResponse.json({ error: "Erro ao atualizar status da instância" }, { status: 500 });
    }

    finalRecord = updated as InstanceRow;
  }

  return NextResponse.json({
    data: {
      id: finalRecord.id,
      status: finalRecord.status,
      qr_code: finalRecord.qr_code,
      phone_number: finalRecord.phone_number,
      last_connected_at: finalRecord.last_connected_at,
      updated_at: finalRecord.updated_at,
    },
  });
}

