import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/auth"];

// Use server-side vars (without NEXT_PUBLIC_ prefix) in Edge Runtime.
// In Vercel, also define SUPABASE_URL and SUPABASE_ANON_KEY (duplicates of
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) so the Edge
// runtime can read them reliably at request time.
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

function sanitizeNextPath(next: string) {
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth")) {
    return "/performance";
  }

  return next;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Do not redirect API routes here; enforce auth inside each handler.
  if (pathname.startsWith("/api")) return response;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return response;
  }

  // Avoid hard-failing deploys when env vars are missing.
  // (Better to set them correctly in Vercel and remove this guard later.)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isRootPath = pathname === "/";
  const isAuthPath = pathname === "/auth";
  const authedLandingPath = "/performance";

  if (!user && isRootPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", authedLandingPath);
    return NextResponse.redirect(url);
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set(
      "next",
      sanitizeNextPath(`${pathname}${request.nextUrl.search}`),
    );
    return NextResponse.redirect(url);
  }

  if (user && (isAuthPath || isRootPath)) {
    const url = request.nextUrl.clone();
    url.pathname = authedLandingPath;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all request paths except for static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
