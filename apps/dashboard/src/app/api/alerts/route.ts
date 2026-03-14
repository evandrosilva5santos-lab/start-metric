import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status") ?? "unread";
  const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

  let query = supabase
    .from("alerts")
    .select("id, org_id, rule_id, campaign_id, metric, operator, threshold, observed_value, channel, title, message, status, triggered_at, read_at")
    .order("triggered_at", { ascending: false })
    .limit(limit);

  if (status === "unread" || status === "read") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
