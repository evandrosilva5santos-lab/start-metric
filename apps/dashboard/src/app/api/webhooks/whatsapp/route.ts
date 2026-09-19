import { NextResponse } from "next/server";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
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

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Fail-closed: sem secret configurado, nenhum webhook é aceito.
function requireWebhookSecret(): string {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("WHATSAPP_WEBHOOK_SECRET não configurado");
  }
  return secret;
}

// Evolution API envia x-evolution-signature no formato "sha256=<hmac-hex>",
// onde o HMAC-SHA256 do body bruto é calculado com o webhook secret.
function verifyEvolutionSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length).toLowerCase()
    : signatureHeader.trim().toLowerCase();
  return timingSafeCompare(provided, expected);
}

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = requireWebhookSecret();
  } catch {
    console.error("[webhooks/whatsapp] WHATSAPP_WEBHOOK_SECRET ausente — webhook rejeitado (fail-closed).");
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 });
  }

  // Body bruto é necessário para calcular o HMAC antes do parse JSON.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-evolution-signature");
  const sharedSecretHeader = request.headers.get("x-webhook-secret");

  const signatureValid = signatureHeader && verifyEvolutionSignature(rawBody, signatureHeader, secret);
  const secretValid = sharedSecretHeader && timingSafeCompare(sharedSecretHeader, secret);

  if (!signatureValid && !secretValid) {
    return NextResponse.json({ error: "Webhook secret inválido" }, { status: 401 });
  }

  try {
    const payload = webhookEventSchema.parse(JSON.parse(rawBody));
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

