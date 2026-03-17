import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/reports — lista relatórios agendados da org
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const { data: reports, error } = await (supabase as any)
    .from("scheduled_reports")
    .select("id, name, frequency, recipients, whatsapp_enabled, next_run_at, last_run_at, status, created_at")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: reports ?? [] });
}

// POST /api/reports — cria um novo relatório agendado
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  let body: {
    name?: string;
    frequency?: string;
    recipients?: string[];
    whatsapp_enabled?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, frequency, recipients, whatsapp_enabled } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  if (!["daily", "weekly", "monthly"].includes(frequency ?? "")) {
    return NextResponse.json({ error: "Frequência inválida" }, { status: 400 });
  }

  // Calcular próxima execução
  const nextRun = calculateNextRun(frequency as "daily" | "weekly" | "monthly");

  const { data: report, error } = await (supabase as any)
    .from("scheduled_reports")
    .insert({
      org_id: profile.org_id,
      template_id: null, // template padrão, sem template customizado por enquanto
      name: name.trim(),
      frequency,
      recipients: recipients ?? [],
      whatsapp_enabled: whatsapp_enabled ?? false,
      next_run_at: nextRun,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ report }, { status: 201 });
}

function calculateNextRun(frequency: "daily" | "weekly" | "monthly"): string {
  const next = new Date();
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      next.setHours(8, 0, 0, 0);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(8, 0, 0, 0);
      break;
  }
  return next.toISOString();
}
