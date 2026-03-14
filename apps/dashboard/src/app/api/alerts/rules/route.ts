import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AlertRuleInput } from "@/lib/alerts/types";

async function getUserOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, orgId: null as string | null, userId: null as string | null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    orgId: (profile?.org_id as string | undefined) ?? null,
    userId: user.id,
  };
}

export async function GET(): Promise<NextResponse> {
  const { supabase, orgId } = await getUserOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notification_rules")
    .select("id, org_id, campaign_id, metric, operator, threshold, channel, active, created_at, updated_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request): Promise<NextResponse> {
  const { supabase, orgId, userId } = await getUserOrgId();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: AlertRuleInput;
  try {
    body = (await request.json()) as AlertRuleInput;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { metric, operator, threshold, campaign_id, active = true } = body;
  if (!metric || !operator || typeof threshold !== "number") {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("notification_rules")
    .insert({
      org_id: orgId,
      campaign_id: campaign_id ?? null,
      metric,
      operator,
      threshold,
      channel: "web_push",
      active,
      created_by: userId,
    })
    .select("id, org_id, campaign_id, metric, operator, threshold, channel, active, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
