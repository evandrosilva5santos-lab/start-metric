import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!code) {
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(authUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", "callback_failed");
    return NextResponse.redirect(authUrl);
  }

  const redirectPath = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
