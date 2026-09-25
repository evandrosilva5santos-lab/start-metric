import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isPlatformAdminEmail } from "@/lib/admin/access";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";

const PUBLIC_PATHS = [
  "/auth",
  "/admin/auth",
  "/manifest.webmanifest",
  "/manifest.json",
  "/icon.svg",
  "/icon-maskable.svg",
  "/favicon.ico",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
];

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminAuthPath = pathname === "/admin/auth" || pathname.startsWith("/admin/auth/");
  const isAdminProtectedPath = isAdminPath && !isAdminAuthPath;
  const isRootPath = pathname === "/";
  const isAuthPath = pathname === "/auth";
  const authedLandingPath = "/performance";

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Do not redirect API routes, icons or manifests; allow public access for PWA installation
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname.endsWith(".webmanifest") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico")
  ) {
    return response;
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Se já autenticado por senha do painel, redireciona /auth para o painel
    const painelCookie = request.cookies.get(PAINEL_COOKIE_NAME)?.value;
    if (isAuthPath && (await isPainelAuthorized(painelCookie))) {
      const url = request.nextUrl.clone();
      url.pathname = authedLandingPath;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // 1. Verificação prioritária de acesso por PAINEL_SENHA
  const painelCookie = request.cookies.get(PAINEL_COOKIE_NAME)?.value;
  const isPainelAuthed = await isPainelAuthorized(painelCookie);

  if (isPainelAuthed) {
    if (isRootPath) {
      const url = request.nextUrl.clone();
      url.pathname = authedLandingPath;
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Fail-closed: sem env vars de autenticação não podemos validar o JWT,
  // então redirecionamos para /auth em vez de deixar a rota passar.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (isRootPath || isAdminProtectedPath || pathname.startsWith("/")) {
      const url = request.nextUrl.clone();
      url.pathname = isAdminProtectedPath ? "/admin/auth" : "/auth";
      url.searchParams.set("next", sanitizeNextPath(`${pathname}${request.nextUrl.search}`));
      return NextResponse.redirect(url);
    }
    return new NextResponse("Autenticação indisponível", { status: 503 });
  }

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

  // getClaims valida o JWT localmente (sem ida ao servidor de Auth quando o
  // projeto usa chave assimétrica) e renova a sessão se o token expirou.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const user = claims?.sub ? { id: claims.sub, email: claims.email } : null;

  if (!user && isRootPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", authedLandingPath);
    return NextResponse.redirect(url);
  }

  if (!user && isAdminProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/auth";
    url.searchParams.set(
      "next",
      sanitizeNextPath(`${pathname}${request.nextUrl.search}`),
    );
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

  if (isAdminProtectedPath && !isPlatformAdminEmail(user.email)) {
    const url = request.nextUrl.clone();
    url.pathname = authedLandingPath;
    return NextResponse.redirect(url);
  }

  if (isAdminAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = isPlatformAdminEmail(user.email) ? "/admin" : authedLandingPath;
    return NextResponse.redirect(url);
  }

  if (isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = authedLandingPath;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all request paths except for static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
