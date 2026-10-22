// Segmentos e produtos da organização (etiquetas dos clientes da Carteira).

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardSession } from "@/lib/auth/session";
import { taxonomyItemSchema, taxonomyTable } from "@/lib/clients/taxonomy";

export const dynamic = "force-dynamic";

type Params = Promise<{ kind: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const table = taxonomyTable((await params).kind);
  if (!table) return NextResponse.json({ error: "Tipo inválido" }, { status: 404 });
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Tabelas novas ainda fora dos tipos gerados do Supabase.
  const db = session.supabase as unknown as SupabaseClient;
  const { data, error } = await db.from(table).select("id, name, color").eq("org_id", session.orgId).order("name");
  if (error) {
    console.error(`[taxonomy] listar ${table}:`, error.message);
    return NextResponse.json({ error: "Erro ao carregar a lista" }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Params }) {
  const table = taxonomyTable((await params).kind);
  if (!table) return NextResponse.json({ error: "Tipo inválido" }, { status: 404 });
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = taxonomyItemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });

  const db = session.supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from(table)
    .insert({ org_id: session.orgId, name: parsed.data.name, color: parsed.data.color })
    .select("id, name, color")
    .single();
  if (error?.code === "23505") return NextResponse.json({ error: "Já existe um com esse nome" }, { status: 409 });
  if (error) {
    console.error(`[taxonomy] criar em ${table}:`, error.message);
    return NextResponse.json({ error: "Não foi possível salvar" }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
