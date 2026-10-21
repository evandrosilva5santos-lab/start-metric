import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import Stripe from "stripe";
import { StripeWebhookPayloadSchema } from "@/lib/stripe/webhook-schema";

export const dynamic = "force-dynamic";

// Inicializa o cliente Stripe para caso seja necessário fetch de line_items
// STRIPE_SECRET_KEY default para evitar erro na inicialização sem uso.
const stripeSecret = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
const stripe = new Stripe(stripeSecret, {
  apiVersion: "2026-08-26.dahlia",
});

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Fail-closed: sem secret configurado, nenhum webhook é aceito.
function requireWebhookSecret(): string {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET não configurado");
  }
  return STRIPE_WEBHOOK_SECRET;
}

export async function POST(req: Request) {
  try {
    const webhookSecret = requireWebhookSecret();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: unknown) {
      console.error("Stripe signature verification failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: "Invalid stripe signature", details: errorMessage }, { status: 400 });
    }

    if (event.type !== "payment_intent.succeeded" && event.type !== "charge.refunded") {
      return NextResponse.json({ received: true, ignored: true, type: event.type });
    }

    const object = event.data.object;

    // Fallback variables
    const status = event.type === "payment_intent.succeeded" ? "completed" : "refunded";
    const external_order_id = object.id || ""; // e.g. pi_123 or ch_123
    const currency = (object.currency || "brl").toUpperCase();
    const total_amount = object.amount ? object.amount / 100 : 0; // Stripe provides amount in cents
    const customer_email = object.receipt_email || ""; // Typical in charges
    const customer_name = object.shipping?.name || "";

    // Extrair dados da metadata (esperamos org_id, etc. lá)
    const metadata = object.metadata || {};
    const payloadInput = {
      org_id: metadata.org_id,
      external_order_id: external_order_id,
      status: status,
      total_amount: total_amount,
      currency: currency,
      customer_email: customer_email || metadata.customer_email || undefined,
      customer_name: customer_name || metadata.customer_name || undefined,
      tracking_session_id: metadata.tracking_session_id || undefined,
      click_id: metadata.click_id || undefined,
      attribution_fbc: metadata.attribution_fbc || undefined,
      attribution_fbp: metadata.attribution_fbp || undefined,
      items: metadata.items ? JSON.parse(metadata.items) : [],
    };

    // Validar de forma segura o que extraímos
    const parsedPayload = StripeWebhookPayloadSchema.safeParse(payloadInput);
    if (!parsedPayload.success) {
      console.error("Payload mismatch for Stripe webhook:", parsedPayload.error);
      return NextResponse.json({ error: "Metadata doesn't match schema requirements (e.g. missing org_id)", details: parsedPayload.error }, { status: 400 });
    }

    const payload = parsedPayload.data;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Identificador para motor de atribuição
    const userIdentifier = payload.attribution_fbc ?? payload.tracking_session_id ?? payload.click_id ?? payload.attribution_fbp ?? payload.customer_email;

    // Inserir registro na tabela conversions
    let conversionId = null;
    const { data: conversion, error: conversionError } = await supabase
      .from("conversions")
      .insert({
        org_id: payload.org_id,
        external_id: `stripe_${payload.external_order_id}`,
        source: "stripe",
        event_type: "purchase", // Em cenários mais avançados pode ser refund também
        revenue: payload.total_amount,
        currency: payload.currency,
        customer_id: payload.tracking_session_id,
        customer_email: payload.customer_email,
        occurred_at: new Date(event.created * 1000).toISOString(),
        attribution_window_days: 30,
      })
      .select("id")
      .single();

    if (conversionError) {
      if (conversionError.code === "23505") { // dup
        // buscar o ID existente se houver conflito
        const { data: existing } = await supabase.from("conversions").select("id").eq("external_id", `stripe_${payload.external_order_id}`).single();
        conversionId = existing?.id;
      } else {
        console.error("Erro inserindo conversion:", conversionError);
      }
    } else {
      conversionId = conversion?.id;
    }

    // Se temos um identificador novo, tentar atribuir automaticamente
    if (conversionId && userIdentifier) {
      await supabase.rpc("attribute_conversion_last_click", {
        p_conversion_id: conversionId,
        p_user_identifier: userIdentifier,
        p_attribution_window_days: 30,
      });
    }

    // Upsert idempotente na tabela sales_orders
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .upsert({
        org_id: payload.org_id,
        external_order_id: payload.external_order_id,
        source: "stripe",
        status: payload.status,
        total_amount: payload.total_amount,
        currency: Object.keys(currency).length ? currency : "BRL",
        customer_email: payload.customer_email,
        customer_name: payload.customer_name,
        tracking_session_id: payload.tracking_session_id,
        attribution_fbc: payload.attribution_fbc,
        attribution_fbp: payload.attribution_fbp,
        click_id: payload.click_id,
        attributed_conversion_id: conversionId,
      }, { onConflict: "org_id, external_order_id, source" })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Erro inserindo sales_order:", orderError);
      return NextResponse.json({ error: orderError?.message || "Failed to upset order" }, { status: 500 });
    }

    // Inserir items da compra se existirem, convertendo-os ao formato da tabela
    if (payload.items && payload.items.length > 0) {
      const orderItems = payload.items.map((item) => ({
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
      conversion_id: conversionId,
      attributed: !!conversionId,
    });
  } catch (error: unknown) {
    console.error("Stripe Webhook Handler Error:", error);
    return NextResponse.json({ error: "Erro interno no processamento do webhook" }, { status: 500 });
  }
}
