import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession, type DashboardSession } from "@/lib/auth/session";
import {
  OperationalAccountError,
  resolveOperationalAccount,
} from "@/lib/accounts/operational";
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
  session: Extract<DashboardSession, { isAuthorized: true }>,
  objectId: string,
): Promise<{ token: string } | { error: NextResponse }> {
  const { data: campaignRow, error: campaignError } = await session.supabase
    .from("campaigns")
    .select("ad_account_id")
    .eq("org_id", session.orgId)
    .eq("meta_id", objectId)
    .limit(1)
    .maybeSingle();

  if (campaignError) {
    return { error: NextResponse.json({ error: "Falha ao validar a campanha." }, { status: 500 }) };
  }
  if (!campaignRow?.ad_account_id) {
    return {
      error: NextResponse.json(
        { error: "Campanha não encontrada nesta organização." },
        { status: 404 },
      ),
    };
  }

  try {
    const account = await resolveOperationalAccount(session.supabase, {
      orgId: session.orgId,
      accountId: campaignRow.ad_account_id,
      platform: "meta",
    });
    if (!account.token_encrypted) {
      return {
        error: NextResponse.json(
          { error: "A conexão Meta desta conta não possui credencial válida." },
          { status: 403 },
        ),
      };
    }
    const token = await decryptToken(account.token_encrypted, session.supabase);
    return { token };
  } catch (err) {
    if (err instanceof OperationalAccountError) {
      return { error: NextResponse.json({ error: err.message, code: err.code }, { status: err.status }) };
    }
    console.error("[meta/campanha] Falha ao descriptografar token:", err);
    return {
      error: NextResponse.json({ error: "Falha ao autenticar com a Meta." }, { status: 500 }),
    };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getDashboardSession();
  if (!session.isAuthorized) {
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

  const scoped = await resolveOrgScopedToken(session, id);
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
