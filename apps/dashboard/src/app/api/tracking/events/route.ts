import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type TrackingEventName = "page_view" | "add_to_cart" | "checkout_start" | "purchase" | "custom";

type TrackingEventPayload = {
  event_id: string;
  event_name: TrackingEventName;
  event_time?: string;
  session_id?: string;
  page_url?: string;
  referrer?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  value?: number;
  currency?: string;
  payload?: Json;
};

function isValidEventName(value: string): value is TrackingEventName {
  return ["page_view", "add_to_cart", "checkout_start", "purchase", "custom"].includes(value);
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
}

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

  let body: TrackingEventPayload;
  try {
    body = (await request.json()) as TrackingEventPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (!body.event_id || !body.event_name) {
    return NextResponse.json({ error: "event_id e event_name são obrigatórios" }, { status: 422 });
  }

  if (!isValidEventName(body.event_name)) {
    return NextResponse.json({ error: "event_name inválido" }, { status: 422 });
  }

  const eventId = body.event_id.trim();
  if (!eventId) {
    return NextResponse.json({ error: "event_id inválido" }, { status: 422 });
  }

  const orgId = profile.org_id;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const rawIp = toOptionalString(forwardedFor?.split(",")[0] ?? null);
  const ipHash = rawIp ? Buffer.from(rawIp).toString("base64") : null;

  const row = {
    org_id: orgId,
    event_id: eventId,
    event_name: body.event_name,
    event_time: body.event_time ?? new Date().toISOString(),
    session_id: toOptionalString(body.session_id),
    page_url: toOptionalString(body.page_url),
    referrer: toOptionalString(body.referrer),
    user_agent: toOptionalString(request.headers.get("user-agent")),
    ip_hash: ipHash,
    campaign_id: toOptionalString(body.campaign_id),
    adset_id: toOptionalString(body.adset_id),
    ad_id: toOptionalString(body.ad_id),
    utm_source: toOptionalString(body.utm_source),
    utm_campaign: toOptionalString(body.utm_campaign),
    utm_content: toOptionalString(body.utm_content),
    gclid: toOptionalString(body.gclid),
    fbclid: toOptionalString(body.fbclid),
    ttclid: toOptionalString(body.ttclid),
    value: toOptionalNumber(body.value),
    currency: toOptionalString(body.currency),
    payload: (body.payload ?? {}) as Json,
  };

  const { error } = await supabase.from("tracking_events").insert(row);

  if (error) {
    // Unique violation (org_id, event_id) => deduplicação idempotente.
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: true, deduplicated: true, event_id: eventId },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deduplicated: false, event_id: eventId }, { status: 201 });
}
