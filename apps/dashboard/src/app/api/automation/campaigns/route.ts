// Campanhas de uma conta (Meta ou Google) para escolher no formulário de regra automática.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const accountId = request.nextUrl.searchParams.get("accountId") ?? "";
  if (!z.string().uuid().safeParse(accountId).success) return NextResponse.json({ error: "Conta inválida" }, { status: 400 });

  const db = createAdminClient() as unknown as SupabaseClient;
  const { data: account } = await db.from("ad_accounts").select("id, platform").eq("org_id", session.orgId).eq("id", accountId).maybeSingle();
  if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  const result =
    account.platform === "google"
      ? await db
          .from("google_ads_campaigns")
          .select("campaign_id, name, status")
          .eq("org_id", session.orgId)
          .eq("ad_account_id", accountId)
          .neq("status", "REMOVED")
          .order("name")
      : await db.from("campaigns").select("meta_id, name, status").eq("org_id", session.orgId).eq("ad_account_id", accountId).order("name");
  if (result.error) {
    console.error("[automation/campaigns]", result.error.message);
    return NextResponse.json({ error: "Erro ao carregar as campanhas" }, { status: 500 });
  }
  const campaigns = ((result.data ?? []) as Array<Record<string, string>>).map((c) => ({
    id: c.campaign_id ?? c.meta_id,
    name: c.name,
    status: c.status,
  }));
  return NextResponse.json({ campaigns });
}
