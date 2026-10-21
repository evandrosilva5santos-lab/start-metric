// Recebe o code do login Google, valida o state, guarda o refresh token criptografado
// e já busca as contas do MCC; volta para /settings/google com o resultado.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDashboardSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeOAuthCode } from "@/lib/google-ads/client";
import { GOOGLE_OAUTH_STATE_COOKIE, googleRedirectUri } from "@/lib/google-ads/oauth";
import { discoverAccounts, saveOAuthConnection } from "@/lib/google-ads/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const settingsUrl = new URL("/settings/google", url.origin);
  const finish = (param: string, value: string) => {
    settingsUrl.searchParams.set(param, value);
    const response = NextResponse.redirect(settingsUrl.toString());
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  };

  if (url.searchParams.get("error")) return finish("error", "oauth_denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return finish("error", "missing_params");

  const expectedState = (await cookies()).get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) return finish("error", "invalid_state");

  const session = await getDashboardSession();
  if (!session.isAuthorized) return finish("error", "unauthenticated");

  const db = createAdminClient() as never;
  try {
    const { refreshToken, email } = await exchangeOAuthCode(code, googleRedirectUri(url.origin));
    await saveOAuthConnection(db, session.orgId, refreshToken, email);
  } catch (err) {
    console.error("[google/callback] conexão:", err instanceof Error ? err.message : err);
    return finish("error", "save_failed");
  }

  try {
    await discoverAccounts(db, session.orgId);
  } catch (err) {
    // A conexão ficou salva; o erro aparece na tela pelo last_error e pelo "Testar conexão".
    console.error("[google/callback] descoberta:", err instanceof Error ? err.message : err);
  }
  return finish("connected", "true");
}
