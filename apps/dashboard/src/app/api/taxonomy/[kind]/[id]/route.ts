// Renomear, trocar a cor ou apagar um segmento/produto. Apagar deixa os clientes sem ele (FK SET NULL).

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { taxonomyTable, taxonomyUpdateSchema } from "@/lib/clients/taxonomy";

export const dynamic = "force-dynamic";

type Params = Promise<{ kind: string; id: string }>;

const idSchema = z.string().uuid();

async function resolve(params: Params) {
  const { kind, id } = await params;
  const table = taxonomyTable(kind);
  return table && idSchema.safeParse(id).success ? { table, id } : null;
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  const target = await resolve(params);
  if (!target) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = taxonomyUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: parsed.success ? "Nada para alterar" : parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const db = session.supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from(target.table)
    .update(parsed.data)
    .eq("id", target.id)
    .eq("org_id", session.orgId)
    .select("id, name, color")
    .maybeSingle();
  if (error?.code === "23505") return NextResponse.json({ error: "Já existe um com esse nome" }, { status: 409 });
  if (error) {
    console.error(`[taxonomy] atualizar ${target.table}:`, error.message);
    return NextResponse.json({ error: "Não foi possível salvar" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const target = await resolve(params);
  if (!target) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = session.supabase as unknown as SupabaseClient;
  const { data, error } = await db.from(target.table).delete().eq("id", target.id).eq("org_id", session.orgId).select("id");
  if (error) {
    console.error(`[taxonomy] apagar ${target.table}:`, error.message);
    return NextResponse.json({ error: "Não foi possível apagar" }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
