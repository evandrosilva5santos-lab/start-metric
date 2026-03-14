// app/api/meta/disconnect/route.ts
// Desconecta uma conta Meta: apaga o registro em ad_accounts.
// RLS garante que apenas o dono da org pode deletar.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const adAccountId = url.searchParams.get("adAccountId");

  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId obrigatório" }, { status: 400 });
  }

  // RLS garante que apenas a org correta pode deletar
  const { error } = await supabase
    .from("ad_accounts")
    .delete()
    .eq("external_id", adAccountId);

  if (error) {
    console.error("[meta/disconnect] Erro:", error);
    return NextResponse.json({ error: "Falha ao desconectar" }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true });
}
