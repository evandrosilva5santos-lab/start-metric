// app/api/meta/oauth/route.ts
// Inicia o fluxo OAuth Meta Ads.
// Gera CSRF state, armazena em cookie httpOnly, redireciona para Meta.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

const META_APP_ID = process.env.META_APP_ID!;

function getRedirectUri(request: Request): string {
  // Prefer explicit override (useful for custom domains), otherwise derive from the request host.
  return process.env.META_REDIRECT_URI ?? new URL("/api/meta/callback", request.url).toString();
}

export async function GET(request: Request) {
  // Requer sessão autenticada
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const redirectUri = getRedirectUri(request);

  if (!META_APP_ID || !redirectUri) {
    console.error("[meta/oauth] META_APP_ID ou redirectUri não configurados.");
    return NextResponse.json(
      { error: "Configuração de integração Meta ausente. Contate o suporte." },
      { status: 500 }
    );
  }

  // CSRF state — 32 bytes hex
  const state = randomBytes(32).toString("hex");

  // Monta URL de autorização Meta (OAuth 2.0)
  const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  authUrl.searchParams.set("client_id", META_APP_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "ads_read,ads_management,business_management");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(authUrl.toString());

  // Armazena state em cookie httpOnly para validação no callback
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutos
    path: "/",
  });

  return response;
}
