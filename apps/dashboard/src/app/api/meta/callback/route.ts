// app/api/meta/callback/route.ts
// Recebe o code OAuth da Meta, valida CSRF, troca por access_token,
// salva a conexão da organização e abre a escolha de contas em /settings/meta.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForToken, fetchMetaUserId } from "@/lib/meta/client";
import { encryptToken } from "@/lib/meta/token";
import { clearOrgMetaAccountsCache } from "@/lib/meta/org-token";
import { HIDDEN_ACCOUNT_STATUS } from "@/lib/meta/account-groups";
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

  const metaSettingsUrl = new URL("/settings/meta", url.origin);

  // Usuário cancelou no lado Meta
  if (errorParam) {
    metaSettingsUrl.searchParams.set("error", "oauth_denied");
    return NextResponse.redirect(metaSettingsUrl.toString());
  }

  if (!code || !state) {
    metaSettingsUrl.searchParams.set("error", "missing_params");
    return NextResponse.redirect(metaSettingsUrl.toString());
  }

  // ── Validação CSRF ────────────────────────────────────────
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meta_oauth_state")?.value;

  if (!expectedState || expectedState !== state) {
    metaSettingsUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(metaSettingsUrl.toString());
  }

  // ── Autenticação Supabase ─────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    metaSettingsUrl.searchParams.set("error", "unauthenticated");
    return NextResponse.redirect(metaSettingsUrl.toString());
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
      metaSettingsUrl.searchParams.set("error", "no_organization");
      return NextResponse.redirect(metaSettingsUrl.toString());
    }

    const tokenEncrypted = await encryptToken(accessToken, supabase);
    const tokenExpiresAt = expiresIn === null ? null : new Date(Date.now() + expiresIn * 1000).toISOString();
    const fbUserId = await fetchMetaUserId(accessToken);

    const { error: connectionError } = await supabase.from("meta_connections").upsert(
      {
        org_id: orgId,
        token_encrypted: tokenEncrypted,
        token_expires_at: tokenExpiresAt,
        fb_user_id: fbUserId,
        connected_by: user.id,
        status: "active",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );
    if (connectionError) {
      console.error("[meta/callback] Erro ao salvar meta_connections:", connectionError);
      metaSettingsUrl.searchParams.set("error", "save_failed");
      return NextResponse.redirect(metaSettingsUrl.toString());
    }

    const { error: refreshError } = await supabase
      .from("ad_accounts")
      .update({ token_encrypted: tokenEncrypted, token_expires_at: tokenExpiresAt, status: "active" })
      .eq("org_id", orgId)
      .eq("platform", "meta")
      .neq("status", HIDDEN_ACCOUNT_STATUS);
    if (refreshError) {
      console.error("[meta/callback] Erro ao renovar o token das contas do painel:", refreshError);
      metaSettingsUrl.searchParams.set("error", "save_failed");
      return NextResponse.redirect(metaSettingsUrl.toString());
    }
    clearOrgMetaAccountsCache(orgId);

    // ── Limpar cookie CSRF e redirecionar para settings/meta ─
    metaSettingsUrl.searchParams.set("connected", "true");
    metaSettingsUrl.searchParams.set("adicionar", "1");
    const response = NextResponse.redirect(metaSettingsUrl.toString());
    response.cookies.set("meta_oauth_state", "", { maxAge: 0, path: "/" });

    return response;
  } catch (err) {
    console.error("[meta/callback] Erro inesperado:", err);
    metaSettingsUrl.searchParams.set("error", "unexpected");
    return NextResponse.redirect(metaSettingsUrl.toString());
  }
}
