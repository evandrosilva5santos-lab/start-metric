import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StripeWebhookItem = {
  product_id: string;
  product_name: string;
  quantity?: number;
  unit_price: number;
};

type StripeWebhookPayload = {
  org_id: string;
  external_order_id: string;
  status?: string;
  total_amount?: number;
  currency?: string;
  customer_email?: string;
  customer_name?: string;
  tracking_session_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  attribution_fbc?: string;
  attribution_fbp?: string;
  click_id?: string;
  items?: StripeWebhookItem[];
};

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SIGNATURE_TOLERANCE_SECONDS = 300;

// Fail-closed: sem secret configurado, nenhum webhook é aceito.
function requireWebhookSecret(): string {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET não configurado");
  }
  return STRIPE_WEBHOOK_SECRET;
}

// Formato Stripe: t=<timestamp>,v1=<hex digest> (pode haver múltiplas entradas v1).
function parseSignatureHeader(signature: string): { timestamp: number; digests: string[] } | null {
  const parts = signature.split(",").map((p) => p.trim());
  let timestamp: number | null = null;
  const digests: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || value === undefined) continue;
    if (key === "t") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      timestamp = parsed;
    } else if (key === "v1") {
      digests.push(value.toLowerCase());
    }
  }

  if (timestamp === null || digests.length === 0) return null;
  return { timestamp, digests };
}

function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  const parsed = parseSignatureHeader(signature);
  if (!parsed) return false;

  // Proteção contra replay: rejeitar timestamps fora da janela de tolerância.
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false;

  const signedPayload = `${parsed.timestamp}.${payload}`;
  const hmac = createHmac("sha256", secret);
  const digest = hmac.update(signedPayload).digest("hex");

  return parsed.digests.some((candidate) => {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(digest, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(req: Request) {
  let secret: string;
  try {
    secret = requireWebhookSecret();
  } catch {
    console.error("[webhooks/stripe] STRIPE_WEBHOOK_SECRET ausente — webhook rejeitado (fail-closed).");
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 });
  }

  try {
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");
    const rawPayload = await req.text();

    // Header de assinatura é obrigatório — ausência = rejeição imediata.
    if (!signature || !verifyStripeSignature(rawPayload, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawPayload) as StripeWebhookPayload;

    const {
      org_id,
      external_order_id,
      status = "completed",
      total_amount = 0,
      currency = "BRL",
      customer_email,
      customer_name,
      tracking_session_id,
      click_id,
      attribution_fbc,
      attribution_fbp,
      items = []
    } = payload;

    if (!org_id || !external_order_id) {
      return NextResponse.json({ error: "org_id e external_order_id são obrigatórios" }, { status: 400 });
    }

    // Supabase Service Role client (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Criar registro na tabela conversions para o motor de atribuição
    const userIdentifier = attribution_fbc ?? tracking_session_id ?? click_id ?? attribution_fbp ?? customer_email;

    const { data: conversion, error: conversionError } = await supabase
      .from("conversions")
      .insert({
        org_id,
        external_id: `stripe_${external_order_id}`,
        source: "stripe",
        event_type: "purchase",
        revenue: total_amount,
        currency,
        customer_id: tracking_session_id,
        customer_email,
        occurred_at: new Date().toISOString(),
        attribution_window_days: 30,
      })
      .select("id")
      .single();

    if (conversionError && conversionError.code !== "23505") {
      console.error("Erro inserindo conversion:", conversionError);
    }

    // 2. Se temos um identificador, tentar atribuir automaticamente
    if (conversion?.id && userIdentifier) {
      await supabase.rpc("attribute_conversion_last_click", {
        p_conversion_id: conversion.id,
        p_user_identifier: userIdentifier,
        p_attribution_window_days: 30,
      });
    }

    // 3. Upsert idempotente no Pedido (mantendo compatibilidade com schema existente)
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .upsert({
        org_id,
        source: "stripe",
        external_order_id,
        status,
        total_amount,
        currency,
        customer_email,
        customer_name,
        tracking_session_id,
        attribution_fbc,
        attribution_fbp,
        click_id,
        attributed_conversion_id: conversion?.id,
      }, { onConflict: "org_id, external_order_id, source" })
      .select()
      .single();

    if (orderError) {
      console.error("Erro inserindo sales_order:", orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 4. Inserir items se existirem
    if (items.length > 0) {
      const orderItems = items.map((item: StripeWebhookItem) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity || 1,
        unit_price: item.unit_price,
        total_price: (item.quantity || 1) * item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from("sales_order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("Erro inserindo sales_order_items:", itemsError);
      }
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      conversion_id: conversion?.id,
      attributed: !!conversion?.id,
    });

  } catch (error: unknown) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Erro interno no webhook" }, { status: 500 });
  }
}
