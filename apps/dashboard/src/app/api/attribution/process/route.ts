import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/attribution/process - Processar conversões pendentes
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

  const body = (await request.json()) as { batch_size?: number };
  const batchSize = body.batch_size ?? 50;

  // Processar conversões pendentes usando a função SQL
  const { data, error } = await supabase.rpc("process_pending_attribution", {
    p_org_id: profile.org_id,
    p_batch_size: Math.min(batchSize, 200),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = data ?? [];
  const successCount = results.filter((r: { success: boolean }) => r.success).length;
  const failedCount = results.length - successCount;

  return NextResponse.json(
    {
      ok: true,
      processed: results.length,
      attributed: successCount,
      failed: failedCount,
      results,
    },
    { status: 200 },
  );
}

// GET /api/attribution/process - Status do processamento
export async function GET(): Promise<NextResponse> {
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

  // Contar conversões pendentes
  const { count: pendingCount } = await supabase
    .from("conversions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id)
    .is("attributed_to_campaign_id", null);

  // Contar conversões atribuídas
  const { count: attributedCount } = await supabase
    .from("conversions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id)
    .not("attributed_to_campaign_id", "is", null);

  return NextResponse.json(
    {
      pending: pendingCount ?? 0,
      attributed: attributedCount ?? 0,
      total: (pendingCount ?? 0) + (attributedCount ?? 0),
    },
    { status: 200 },
  );
}
