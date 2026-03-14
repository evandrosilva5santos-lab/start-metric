import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  // Supabase Service Role client (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const payload = (await req.json()) as StripeWebhookPayload;

    // Idempotência básica para testes (espera { org_id, external_order_id, status, total_amount, ... })
    // No MVP focado na POC, aceitamos um POST direto se as propriedades básicas existirem.
    
    // Fallback: usar o JSON enviado simulando um checkout do Stripe ou e-commerce
    const {
      org_id,
      external_order_id,
      status,
      total_amount,
      currency = "BRL",
      customer_email,
      customer_name,
      tracking_session_id,
      utm_source,
      utm_medium,
      utm_campaign,
      attribution_fbc,
      attribution_fbp,
      click_id,
      items = []
    } = payload;

    if (!org_id || !external_order_id) {
      return NextResponse.json({ error: "org_id e external_order_id são obrigatórios" }, { status: 400 });
    }

    // Upsert idempotente no Pedido usando ON CONFLICT
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
        utm_source,
        utm_medium,
        utm_campaign,
        attribution_fbc,
        attribution_fbp,
        click_id
      }, { onConflict: "org_id, external_order_id, source" })
      .select()
      .single();

    if (orderError) {
      console.error("Erro inserindo sales_order:", orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // Inserir items se existirem
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

    // Motor de atribuição mínimo Last Click
    // (Ainda pendente acionar rotina para marcar a campanha com ROAS)
    
    return NextResponse.json({ success: true, order_id: order.id });

  } catch (error: unknown) {
    console.error("Webhook Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
