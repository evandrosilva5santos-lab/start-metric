import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth")) {
    return "/performance";
  }

  return next;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", "missing_code");
    authUrl.searchParams.set("next", next);
    return NextResponse.redirect(authUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", "callback_failed");
    authUrl.searchParams.set("next", next);
    return NextResponse.redirect(authUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", "callback_failed");
    authUrl.searchParams.set("next", next);
    return NextResponse.redirect(authUrl);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.org_id) {
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", "profile_setup_failed");
    authUrl.searchParams.set("next", next);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
