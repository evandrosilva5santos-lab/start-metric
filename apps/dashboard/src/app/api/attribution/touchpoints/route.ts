import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TouchpointPayload = {
  user_identifier: string;
  session_id?: string;
  campaign_id?: string;
  ad_account_id?: string;
  platform: string;
  referrer?: string;
  landing_page?: string;
  device_type?: string;
  occurred_at?: string;
};

function isValidPlatform(value: string): boolean {
  return ["meta", "google", "tiktok", "organic", "direct", "other"].includes(value);
}

// POST /api/attribution/touchpoints - Registrar touchpoint
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

  let body: TouchpointPayload;
  try {
    body = (await request.json()) as TouchpointPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // Validação
  if (!body.user_identifier || !body.platform) {
    return NextResponse.json(
      { error: "user_identifier e platform são obrigatórios" },
      { status: 422 },
    );
  }

  if (!isValidPlatform(body.platform)) {
    return NextResponse.json(
      { error: "platform inválido. Use: meta, google, tiktok, organic, direct, other" },
      { status: 422 },
    );
  }

  const orgId = profile.org_id;

  // Buscar campaign_id e ad_account_id se não fornecidos mas UTM params presentes
  let campaignId = body.campaign_id;
  let adAccountId = body.ad_account_id;

  if (!campaignId && body.session_id) {
    // Tentar deduzir de campanhas ativas na organização
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, ad_account_id")
      .eq("org_id", orgId)
      .eq("status", "ACTIVE")
      .limit(1);

    if (campaigns && campaigns.length > 0) {
      campaignId = campaigns[0].id;
      adAccountId = campaigns[0].ad_account_id;
    }
  }

  // Inserir touchpoint
  const { data, error } = await supabase
    .from("attribution_touchpoints")
    .insert({
      org_id: orgId,
      user_identifier: body.user_identifier,
      session_id: body.session_id,
      campaign_id,
      ad_account_id,
      platform: body.platform,
      referrer: body.referrer,
      landing_page: body.landing_page,
      device_type: body.device_type,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      touchpoint_id: data?.id,
      message: "Touchpoint registrado",
    },
    { status: 201 },
  );
}

// GET /api/attribution/touchpoints - Listar touchpoints
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
  const userIdentifier = searchParams.get("user_identifier");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  let query = supabase
    .from("attribution_touchpoints")
    .select("*")
    .eq("org_id", profile.org_id)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(limit, 200));

  if (userIdentifier) {
    query = query.eq("user_identifier", userIdentifier);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ touchpoints: data ?? [] }, { status: 200 });
}
