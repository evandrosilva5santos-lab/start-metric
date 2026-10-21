// Ajusta uma conta Google Ads do painel: mostrar/ocultar e vincular a um cliente da mesma org.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const bodySchema = z
  .object({
    status: z.enum(["active", "hidden"]).optional(),
    clientId: z.string().uuid().nullable().optional(),
  })
  .refine((b) => b.status !== undefined || b.clientId !== undefined, "Nada para alterar");

export async function PATCH(request: Request, { params }: { params: Params }) {
  const { id } = await params;
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { data: account } = await db
    .from("ad_accounts")
    .select("id")
    .eq("id", id)
    .eq("org_id", session.orgId)
    .eq("platform", "google")
    .maybeSingle();
  if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  const { status, clientId } = parsed.data;
  if (clientId) {
    const { data: client } = await db
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("org_id", session.orgId)
      .is("archived_at", null)
      .maybeSingle();
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }

  const update: { status?: string; client_id?: string | null } = {};
  if (status !== undefined) update.status = status;
  if (clientId !== undefined) update.client_id = clientId;
  const { error } = await db.from("ad_accounts").update(update).eq("id", id).eq("org_id", session.orgId);
  if (error) {
    console.error("[google-ads/accounts] update:", error.message);
    return NextResponse.json({ error: "Não foi possível salvar a conta" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
