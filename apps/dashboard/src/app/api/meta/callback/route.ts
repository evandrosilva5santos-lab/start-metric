// app/api/meta/callback/route.ts
// Recebe o code OAuth da Meta, valida CSRF, troca por access_token,
// criptografa e salva em ad_accounts. Redireciona para /settings/meta.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForToken, fetchAdAccounts } from "@/lib/meta/client";
import { encryptToken } from "@/lib/meta/token";
import { cookies } from "next/headers";

function getRedirectUri(url: URL): string {
  // Prefer explicit override (useful for custom domains), otherwise derive from the request host.
  return process.env.META_REDIRECT_URI ?? new URL("/api/meta/callback", url.origin).toString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const settingsUrl = new URL("/settings/meta", url.origin);

  // Usuário cancelou no lado Meta
  if (errorParam) {
    settingsUrl.searchParams.set("error", "oauth_denied");
    return NextResponse.redirect(settingsUrl.toString());
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("error", "missing_params");
    return NextResponse.redirect(settingsUrl.toString());
  }

  // ── Validação CSRF ────────────────────────────────────────
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meta_oauth_state")?.value;

  if (!expectedState || expectedState !== state) {
    settingsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(settingsUrl.toString());
  }

  // ── Autenticação Supabase ─────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    settingsUrl.searchParams.set("error", "unauthenticated");
    return NextResponse.redirect(settingsUrl.toString());
  }

  try {
    // ── Trocar code por access_token ────────────────────────
    const redirectUri = getRedirectUri(url);
    const { accessToken, expiresIn } = await exchangeCodeForToken(code, redirectUri);

    // ── Buscar org_id do usuário ────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    const orgId = profile?.org_id;
    if (!orgId) {
      settingsUrl.searchParams.set("error", "no_organization");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // ── Buscar contas de anúncios vinculadas ao token ───────
    const adAccounts = await fetchAdAccounts(accessToken);

    if (adAccounts.length === 0) {
      settingsUrl.searchParams.set("error", "no_ad_accounts");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // ── Criptografar token ──────────────────────────────────
    const tokenEncrypted = await encryptToken(accessToken, supabase);
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // ── Salvar cada conta de anúncios ───────────────────────
    // Upsert seguro: se já existir (org_id + external_id), atualiza o token.
    const upserts = adAccounts.map((acc) => ({
      org_id: orgId,
      platform: "meta",
      external_id: acc.id,
      name: acc.name,
      currency: acc.currency,
      timezone: acc.timezone_name,
      token_encrypted: tokenEncrypted,
      token_expires_at: tokenExpiresAt,
      status: "active",
    }));

    const { error: upsertError } = await supabase
      .from("ad_accounts")
      .upsert(upserts, { onConflict: "org_id,external_id" });

    if (upsertError) {
      console.error("[meta/callback] Erro ao salvar ad_accounts:", upsertError);
      settingsUrl.searchParams.set("error", "save_failed");
      return NextResponse.redirect(settingsUrl.toString());
    }

    // ── Limpar cookie CSRF ──────────────────────────────────
    settingsUrl.searchParams.set("connected", "true");
    const response = NextResponse.redirect(settingsUrl.toString());
    response.cookies.set("meta_oauth_state", "", { maxAge: 0, path: "/" });

    return response;
  } catch (err) {
    console.error("[meta/callback] Erro inesperado:", err);
    settingsUrl.searchParams.set("error", "unexpected");
    return NextResponse.redirect(settingsUrl.toString());
  }
}
