import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConversionPayload = {
  external_id: string;
  source: "stripe" | "shopify" | "api" | "manual";
  event_type: "purchase" | "lead" | "signup" | "custom";
  revenue?: number;
  currency?: string;
  customer_id?: string;
  customer_email?: string;
  occurred_at: string;
  user_identifier?: string;
  attribution_window_days?: number;
};

type TouchpointPayload = {
  user_identifier: string;
  session_id?: string;
  campaign_id?: string;
  ad_account_id?: string;
  platform: string;
  referrer?: string;
  landing_page?: string;
  device_type?: string;
  occurred_at: string;
};

function isValidSource(value: string): value is ConversionPayload["source"] {
  return ["stripe", "shopify", "api", "manual"].includes(value);
}

function isValidEventType(value: string): value is ConversionPayload["event_type"] {
  return ["purchase", "lead", "signup", "custom"].includes(value);
}

// POST /api/attribution/conversions - Criar conversão
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.org_id) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 403 });
  }

  let body: ConversionPayload;
  try {
    body = (await request.json()) as ConversionPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // Validação
  if (!body.external_id || !body.source || !body.event_type || !body.occurred_at) {
    return NextResponse.json(
      { error: "external_id, source, event_type e occurred_at são obrigatórios" },
      { status: 422 },
    );
  }

  if (!isValidSource(body.source)) {
    return NextResponse.json({ error: "source inválido" }, { status: 422 });
  }

  if (!isValidEventType(body.event_type)) {
    return NextResponse.json({ error: "event_type inválido" }, { status: 422 });
  }

  const orgId = profile.org_id;

  // Inserir conversão
  const { data: conversion, error: insertError } = await supabase
    .from("conversions")
    .insert({
      org_id: orgId,
      external_id: body.external_id,
      source: body.source,
      event_type: body.event_type,
      revenue: body.revenue ?? 0,
      currency: body.currency ?? "BRL",
      customer_id: body.customer_id,
      customer_email: body.customer_email,
      occurred_at: body.occurred_at,
      attribution_window_days: body.attribution_window_days ?? 30,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Unique violation - conversão já existe
      return NextResponse.json(
        { ok: true, deduplicated: true, external_id: body.external_id },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Se user_identifier fornecido, tentar atribuir automaticamente
  if (body.user_identifier && conversion?.id) {
    const { data: attribution } = await supabase.rpc("attribute_conversion_last_click", {
      p_conversion_id: conversion.id,
      p_user_identifier: body.user_identifier,
      p_attribution_window_days: body.attribution_window_days ?? 30,
    });

    return NextResponse.json(
      {
        ok: true,
        conversion_id: conversion.id,
        attribution: attribution?.[0] ?? null,
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      conversion_id: conversion?.id,
      message: "Conversão criada. Use /api/attribution/attribute para atribuir manualmente.",
    },
    { status: 201 },
  );
}

// GET /api/attribution/conversions - Listar conversões
export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.org_id) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const attributed = searchParams.get("attributed");

  let query = supabase
    .from("v_conversions_attributed")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("occurred_at", { ascending: false });

  if (attributed === "true") {
    query = query.not("attributed_to_campaign_id", "is", null);
  } else if (attributed === "false") {
    query = query.is("attributed_to_campaign_id", null);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversions: data ?? [] }, { status: 200 });
}
