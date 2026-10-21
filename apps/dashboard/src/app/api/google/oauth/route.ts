// Inicia o login Google (OAuth) para o Google Ads: state CSRF em cookie httpOnly e redireciona ao Google.

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth/session";
import { oauthScopes, readGoogleAdsConfig } from "@/lib/google-ads/client";
import { GOOGLE_OAUTH_STATE_COOKIE, googleRedirectUri } from "@/lib/google-ads/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const origin = new URL(request.url).origin;
  const config = readGoogleAdsConfig();
  if (!config.oauthClientId || !config.oauthClientSecret) {
    return NextResponse.redirect(new URL("/settings/google?error=oauth_not_configured", origin));
  }

  const state = randomBytes(32).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.oauthClientId);
  authUrl.searchParams.set("redirect_uri", googleRedirectUri(origin));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", oauthScopes());
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return response;
}
