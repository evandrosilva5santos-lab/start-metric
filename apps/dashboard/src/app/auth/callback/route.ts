import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth")) {
    return "/";
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

  // Fallback: Auto-create profile and organization if they don't exist
  if (profileError || !profile?.org_id) {
    const userName = user.user_metadata?.full_name || user.user_metadata?.name || "Usuário";

    // Create organization first
    const { data: newOrg } = await supabase
      .from("organizations")
      .insert({ name: `${userName} Organization`, plan: "free", timezone: "America/Sao_Paulo" })
      .select("id")
      .single();

    if (newOrg?.id) {
      // Create profile linking user to organization
      const { error: insertProfileError } = await supabase
        .from("profiles")
        .insert({ id: user.id, name: userName, org_id: newOrg.id, role: "owner" });

      if (insertProfileError) {
        console.error("Failed to create profile:", insertProfileError);
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
