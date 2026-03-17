import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapEvolutionStateToStatus,
  type EvolutionConnectionState,
} from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const webhookEventSchema = z.object({
  event: z.string().min(1),
  instance: z.string().min(1),
  data: z.unknown().optional(),
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractConnectionState(data: unknown): EvolutionConnectionState | null {
  if (!isObject(data)) return null;
  const state = data.state;
  return typeof state === "string" ? state : null;
}

function extractQrBase64(data: unknown): string | null {
  if (!isObject(data)) return null;

  if (typeof data.base64 === "string") {
    return data.base64;
  }

  const qrcode = data.qrcode;
  if (isObject(qrcode) && typeof qrcode.base64 === "string") {
    return qrcode.base64;
  }

  return null;
}

function extractPhone(data: unknown): string | null {
  if (!isObject(data)) return null;

  if (typeof data.phone === "string") return data.phone;
  if (typeof data.number === "string") return data.number;
  if (typeof data.wuid === "string") return data.wuid;

  const instanceData = data.instance;
  if (isObject(instanceData) && typeof instanceData.wuid === "string") {
    return instanceData.wuid;
  }

  return null;
}

function hasValidWebhookSecret(request: Request): boolean {
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const headerSignature = request.headers.get("x-evolution-signature");
  const headerSecret = request.headers.get("x-webhook-secret");

  return (
    querySecret === expectedSecret ||
    headerSignature === expectedSecret ||
    headerSecret === expectedSecret
  );
}

export async function POST(request: Request) {
  if (!hasValidWebhookSecret(request)) {
    return NextResponse.json({ error: "Webhook secret inválido" }, { status: 401 });
  }

  try {
    const payload = webhookEventSchema.parse(await request.json());
    const admin = createAdminClient();

    if (payload.event === "connection.update") {
      const state = extractConnectionState(payload.data);
      if (!state) {
        return NextResponse.json({ data: { ignored: true, reason: "state ausente" } });
      }

      const nextStatus = mapEvolutionStateToStatus(state);
      const nextPhone = extractPhone(payload.data);

      const updatePayload: {
        status: string;
        last_connected_at?: string;
        phone_number?: string;
      } = {
        status: nextStatus,
      };

      if (nextStatus === "connected") {
        updatePayload.last_connected_at = new Date().toISOString();
      }

      if (nextPhone) {
        updatePayload.phone_number = nextPhone;
      }

      const { error } = await admin
        .from("whatsapp_instances")
        .update(updatePayload)
        .eq("instance_name", payload.instance);

      if (error) {
        console.error("Erro ao processar webhook connection.update:", error);
        return NextResponse.json({ error: "Falha ao atualizar instância" }, { status: 500 });
      }
    } else if (payload.event === "qrcode.updated") {
      const qrCode = extractQrBase64(payload.data);
      if (!qrCode) {
        return NextResponse.json({ data: { ignored: true, reason: "QR ausente" } });
      }

      const { error } = await admin
        .from("whatsapp_instances")
        .update({
          status: "connecting",
          qr_code: qrCode,
        })
        .eq("instance_name", payload.instance);

      if (error) {
        console.error("Erro ao processar webhook qrcode.updated:", error);
        return NextResponse.json({ error: "Falha ao atualizar QR code" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ data: { ignored: true, event: payload.event } });
    }

    return NextResponse.json({ data: { received: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido", details: error.issues }, { status: 400 });
    }

    console.error("Erro ao processar webhook do WhatsApp:", error);
    return NextResponse.json({ error: "Erro interno no webhook" }, { status: 500 });
  }
}

