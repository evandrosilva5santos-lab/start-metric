import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

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

// Assinatura webhook do Stripe (para produção)
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function verifyStripeSignature(payload: string, signature: string): boolean {
  if (!STRIPE_WEBHOOK_SECRET) return true; // Skip verification in development

  try {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET);
    const digest = hmac.update(payload).digest("hex");

    // Stripe signature format: t=timestamp,v1=signature
    const expectedSignature = `t=${signature.split(",")[0].split("=")[1]},v1=${digest}`;
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // Supabase Service Role client (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    const rawPayload = await req.text();
    const payload = JSON.parse(rawPayload) as StripeWebhookPayload;

    // Verificar assinatura em produção
    if (signature && !verifyStripeSignature(rawPayload, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Fallback: usar o JSON enviado simulando um checkout do Stripe ou e-commerce
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
      attribution_fbc, // Facebook Click ID (fbc)
      attribution_fbp, // Facebook Browser ID (fbp)
      items = []
    } = payload;

    if (!org_id || !external_order_id) {
      return NextResponse.json({ error: "org_id e external_order_id são obrigatórios" }, { status: 400 });
    }

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
        attributed_conversion_id: conversion?.id, // Link com a tabela conversions
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
        // Não falhamos a rota se os itens falharem parcialmente (em MVP), mas registramos erro.
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
