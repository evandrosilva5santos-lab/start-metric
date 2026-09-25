import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/meta/token";
import { createGraphClient, MetaGraphError } from "@/lib/meta/graph";
import { montarPainel } from "@/lib/meta/painel";
import type { DadosResponse } from "@/lib/meta/dados-types";

export const dynamic = "force-dynamic";

/** A resposta fica guardada 90s: dentro disso, ninguém chama a Meta de novo. */
const CACHE_TTL_MS = 90 * 1000;
/** Depois de um erro de limite, a Meta segue recusando por minutos. Não insistimos. */
const RATE_LIMIT_PAUSE_MS = 5 * 60 * 1000;

const memoryCache = new Map<string, { timestamp: number; data: DadosResponse }>();
const rateLimitedUntil = new Map<string, number>();

// ---------------------------------------------------------------- rota

export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const accountId = searchParams.get("account_id");
  if (!accountId || !/^act_[0-9]+$/.test(accountId)) {
    return NextResponse.json({ error: "Parâmetro account_id é obrigatório (formato act_...)" }, { status: 400 });
  }
  const rangeType = searchParams.get("range") || "last_30d";

  let token: string | null = null;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 403 });
  }

  const orgId: string = profile.org_id;

  // Só contas que a própria organização ligou, com o token dela.
  const { data: adAccount } = await supabase
    .from("ad_accounts")
    .select("token_encrypted")
    .eq("org_id", orgId)
    .eq("platform", "meta")
    .eq("external_id", accountId)
    .maybeSingle();

  if (!adAccount) {
    return NextResponse.json({ error: "Conta de anúncio não encontrada nesta organização." }, { status: 404 });
  }

  if (adAccount.token_encrypted) {
    try {
      token = await decryptToken(adAccount.token_encrypted, supabase);
    } catch (err) {
      console.error("[meta/dados] Falha ao descriptografar token da conta:", err);
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: "A conexão com a Meta desta conta expirou. Conecte de novo em Configurações > Meta." },
      { status: 403 },
    );
  }

  const cacheKey = `${orgId}_${accountId}_${rangeType}`;
  const limitKey = `${orgId}_${accountId}`;
  const now = Date.now();
  const cached = memoryCache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, cached: true, cacheAgeSeconds: Math.round((now - cached.timestamp) / 1000) });
  }

  if ((rateLimitedUntil.get(limitKey) ?? 0) > now) {
    return rateLimitResponse(cached, now);
  }

  try {
    const payload = await montarPainel(createGraphClient(token), accountId, rangeType);
    if (memoryCache.size >= 200) {
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey !== undefined) memoryCache.delete(oldestKey);
    }
    memoryCache.set(cacheKey, { timestamp: now, data: payload });
    rateLimitedUntil.delete(limitKey);
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof MetaGraphError) {
      if (err.isRateLimit) {
        rateLimitedUntil.set(limitKey, now + RATE_LIMIT_PAUSE_MS);
        return rateLimitResponse(cached, now);
      }
      if (err.isTokenInvalid) {
        return NextResponse.json(
          { error: "A Meta recusou o acesso desta conta (erro 190: conexão expirada ou revogada). Conecte de novo em Configurações > Meta." },
          { status: 403 },
        );
      }
      console.error(`[meta/dados] Erro da Meta em ${err.where}:`, err.code, err.message);
      return NextResponse.json(
        { error: `A Meta devolveu erro ${err.code}${err.subcode ? ` (${err.subcode})` : ""} ao buscar ${err.where}: ${err.userMessage ?? err.message}` },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[meta/dados] Erro inesperado:", message);
    return NextResponse.json({ error: "Erro interno no servidor: " + message }, { status: 500 });
  }
}

/** Erro 17: mostra o último dado bom com o aviso, ou só o aviso. Nunca tabela vazia. */
function rateLimitResponse(cached: { timestamp: number; data: DadosResponse } | undefined, now: number): NextResponse {
  if (cached) {
    const minutes = Math.max(1, Math.round((now - cached.timestamp) / 60000));
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cacheAgeSeconds: Math.round((now - cached.timestamp) / 1000),
      rateLimited: true,
      warning: `A Meta atingiu o limite de consultas desta conta (erro 17). Você está vendo os dados de ${minutes} min atrás; o painel tenta de novo sozinho em alguns minutos.`,
    });
  }
  return NextResponse.json(
    {
      error:
        "A Meta atingiu o limite de consultas desta conta (erro 17) e está recusando novas chamadas por alguns minutos. Nenhum dado foi perdido: espere uns 5 minutos e tente de novo.",
      rateLimited: true,
    },
    { status: 429 },
  );
}
