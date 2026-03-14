import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (typeof body.active === "boolean") payload.active = body.active;
  if (typeof body.threshold === "number") payload.threshold = body.threshold;
  if (typeof body.operator === "string") payload.operator = body.operator;
  if (typeof body.metric === "string") payload.metric = body.metric;
  if (typeof body.campaign_id === "string" || body.campaign_id === null) payload.campaign_id = body.campaign_id;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("notification_rules")
    .update(payload)
    .eq("id", id)
    .select("id, org_id, campaign_id, metric, operator, threshold, channel, active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_: Request, context: Context): Promise<NextResponse> {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { error } = await supabase.from("notification_rules").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
