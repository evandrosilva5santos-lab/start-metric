import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/meta/token";
import { logCampaignActionInBackground } from "@/lib/meta/supabase-sync";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  id: z.string().regex(/^[0-9]+$/, "id deve ser numérico").max(64),
  type: z.enum(["campaign", "adset"]).default("campaign"),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  daily_budget: z.number().positive().max(1_000_000).optional(),
});

// Resolve o access token da org do usuário para o objeto informado
async function resolveOrgScopedToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  objectId: string,
): Promise<{ token: string } | { error: NextResponse }> {
  const { data: accountByExternalId } = await supabase
    .from("ad_accounts")
    .select("id, token_encrypted")
    .eq("platform", "meta")
    .eq("external_id", `act_${objectId}`)
    .maybeSingle();

  let accountId = accountByExternalId?.id;
  let tokenEncrypted = accountByExternalId?.token_encrypted;

  if (!accountId) {
    const { data: campaignRow } = await supabase
      .from("campaigns")
      .select("ad_account_id, ad_accounts(id, token_encrypted)")
      .eq("meta_id", objectId)
      .limit(1)
      .maybeSingle();

    const joined = campaignRow?.ad_accounts as { id: string; token_encrypted: string | null } | null;
    if (joined?.id) {
      accountId = joined.id;
      tokenEncrypted = joined.token_encrypted;
    }
  }

  if (!accountId || !tokenEncrypted) {
    return {
      error: NextResponse.json(
        { error: "Objeto não encontrado ou sem permissão nesta organização." },
        { status: 403 },
      ),
    };
  }

  try {
    const token = await decryptToken(tokenEncrypted, supabase);
    return { token };
  } catch (err) {
    console.error("[meta/campanha] Falha ao descriptografar token:", err);
    return {
      error: NextResponse.json({ error: "Falha ao autenticar com a Meta." }, { status: 500 }),
    };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let parsed: z.infer<typeof updateSchema>;
  try {
    parsed = updateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Parâmetros inválidos", details: err.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { id, status, daily_budget } = parsed;

  if (!status && daily_budget === undefined) {
    return NextResponse.json({ error: "Informe status ou daily_budget." }, { status: 400 });
  }

  const scoped = await resolveOrgScopedToken(supabase, id);
  if ("error" in scoped) return scoped.error;
  const token = scoped.token;

  const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
  const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

  const params = new URLSearchParams();
  params.append("access_token", token);

  if (status) params.append("status", status);
  if (daily_budget !== undefined) {
    params.append("daily_budget", String(Math.round(daily_budget * 100)));
  }

  try {
    const updateRes = await fetch(`${BASE_URL}/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    const updateData = await updateRes.json();

    if (updateData.error) {
      return NextResponse.json(
        {
          error: `Erro ao atualizar na Meta (${updateData.error.code}): ${updateData.error.message}`,
        },
        { status: 400 },
      );
    }

    if (status) {
      logCampaignActionInBackground(id, status);
    }

    return NextResponse.json({
      success: true,
      id,
      type: parsed.type,
      updated: {
        status: status || undefined,
        daily_budget: daily_budget ?? undefined,
      },
      message: "Atualizado com sucesso na Meta!",
    });
  } catch (err) {
    console.error("[meta/campanha] Erro inesperado:", err);
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
