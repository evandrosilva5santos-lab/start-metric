import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Shopify webhook payload structure (simplified)
type ShopifyWebhookPayload = {
  id: string;
  email?: string;
  phone?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  total_price: string;
  currency: string;
  financial_status: string;
  order_number: number;
  created_at: string;
  updated_at: string;
  tags?: string;
  note?: string;
  referring_site?: string;
  landing_site?: string;
  source_name?: string;
  source_identifier?: string;
  attribution?: {
    fbc?: string; // Facebook Click ID
    fbp?: string; // Facebook Browser ID
    fbcid?: string; // Facebook Click ID (alternative)
  };
  line_items?: Array<{
    id: string;
    product_id: string;
    title: string;
    quantity: number;
    price: string;
  }>;
  customer?: {
    id: string;
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
  };
};

// Shopify webhook signature verification
function verifyShopifySignature(payload: string, signature: string): boolean {
  const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!SHOPIFY_WEBHOOK_SECRET) return true; // Skip verification in development

  try {
    const hmac = createHmac("sha256", SHOPIFY_WEBHOOK_SECRET);
    const digest = hmac.update(payload).digest("base64");
    return digest === signature;
  } catch {
    return false;
  }
}

function extractOrgFromTopic(topic: string): string | null {
  // Topic format: orders/create, orders/updated, etc.
  // Para MVP, assumimos que a org_id está no header customizado
  return null;
}

// Mapear status financeiro do Shopify para nosso status
function mapOrderStatus(financialStatus: string): string {
  const statusMap: Record<string, string> = {
    paid: "completed",
    partially_paid: "partial",
    refunded: "refunded",
    partially_refunded: "partial_refund",
    voided: "cancelled",
  };
  return statusMap[financialStatus] ?? "pending";
}

export async function POST(req: Request) {
  // Supabase Service Role client (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const headersList = await headers();

    // Shopify headers
    const shopifyTopic = headersList.get("X-Shopify-Topic");
    const shopifySignature = headersList.get("X-Shopify-Hmac-Sha256");
    const shopifyShopDomain = headersList.get("X-Shopify-Shop-Domain");
    const shopifyApiVersion = headersList.get("X-Shopify-API-Version");

    // Header customizado para org_id (configurado no Shopify webhook)
    const orgId = headersList.get("X-Custom-Org-Id");

    if (!orgId) {
      return NextResponse.json({ error: "X-Custom-Org-Id header is required" }, { status: 400 });
    }

    const rawPayload = await req.text();
    const payload = JSON.parse(rawPayload) as ShopifyWebhookPayload;

    // Verificar assinatura em produção
    if (shopifySignature && !verifyShopifySignature(rawPayload, shopifySignature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Extrair dados do pedido
    const externalOrderId = payload.id || `${shopifyShopDomain}-${payload.order_number}`;
    const totalPrice = parseFloat(payload.total_price) || 0;
    const currency = payload.currency || "BRL";
    const status = mapOrderStatus(payload.financial_status);
    const customerEmail = payload.email || payload.customer?.email;
    const customerPhone = payload.phone || payload.customer?.phone;
    const customerName = [payload.customer_first_name, payload.customer_last_name]
      .filter(Boolean)
      .join(" ") || [payload.customer?.first_name, payload.customer?.last_name]
      .filter(Boolean)
      .join(" ");

    // Extrair identificadores de atribuição
    const attributionFbc = payload.attribution?.fbc || payload.attribution?.fbcid;
    const attributionFbp = payload.attribution?.fbp;
    const trackingSessionId = payload.source_identifier;
    const referringSite = payload.referring_site;
    const landingSite = payload.landing_site;
    const sourceName = payload.source_name; // web, facebook, instagram, etc.

    // Criar user identifier para atribuição last-click
    const userIdentifier = attributionFbc || trackingSessionId || attributionFbp || customerEmail;

    // 1. Criar registro na tabela conversions para o motor de atribuição
    const { data: conversion, error: conversionError } = await supabase
      .from("conversions")
      .insert({
        org_id: orgId,
        external_id: `shopify_${externalOrderId}`,
        source: "shopify",
        event_type: status === "completed" ? "purchase" : "lead",
        revenue: totalPrice,
        currency,
        customer_id: payload.customer?.id,
        customer_email: customerEmail,
        occurred_at: payload.created_at,
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

    // 3. Registrar touchpoint se temos informações de origem
    if (conversion?.id && (referringSite || landingSite || sourceName)) {
      await supabase
        .from("attribution_touchpoints")
        .insert({
          org_id: orgId,
          user_identifier: userIdentifier || customerEmail || "unknown",
          session_id: trackingSessionId,
          platform: sourceName === "facebook" || sourceName === "instagram" ? "meta" : sourceName || "other",
          referrer: referringSite,
          landing_page: landingSite,
          occurred_at: payload.created_at,
        });
    }

    // 4. Upsert idempotente no Pedido (mantendo compatibilidade com schema existente)
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .upsert({
        org_id: orgId,
        source: "shopify",
        external_order_id: externalOrderId,
        status,
        total_amount: totalPrice,
        currency,
        customer_email: customerEmail,
        customer_name: customerName,
        tracking_session_id: trackingSessionId,
        utm_source: sourceName,
        referrer: referringSite,
        landing_page: landingSite,
        attribution_fbc: attributionFbc,
        attribution_fbp: attributionFbp,
        attributed_conversion_id: conversion?.id,
        shop_domain: shopifyShopDomain,
        shopify_order_number: payload.order_number,
        shopify_topic: shopifyTopic,
      }, {
        onConflict: "org_id, external_order_id, source"
      })
      .select()
      .single();

    if (orderError) {
      console.error("Erro inserindo sales_order:", orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 5. Inserir line items se existirem
    if (payload.line_items && payload.line_items.length > 0) {
      const orderItems = payload.line_items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.title,
        quantity: item.quantity,
        unit_price: parseFloat(item.price),
        total_price: item.quantity * parseFloat(item.price),
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
      shopify_order_number: payload.order_number,
      conversion_id: conversion?.id,
      attributed: !!conversion?.id && !!conversion.attributed_to_campaign_id,
    });

  } catch (error: unknown) {
    console.error("Shopify Webhook Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
