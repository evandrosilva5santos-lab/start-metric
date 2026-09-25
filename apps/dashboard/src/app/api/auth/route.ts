import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  PAINEL_COOKIE_NAME,
  hasPasswordConfigured,
} from "@/lib/auth/painel";

export const dynamic = "force-dynamic";

const PAINEL_SENHA = process.env.PAINEL_SENHA || process.env.DASHBOARD_PASSWORD || "";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const pass = String(body.password || "").trim();

    if (!PAINEL_SENHA) {
      if (process.env.NODE_ENV !== "production") {
        const res = NextResponse.json({ ok: true, authenticated: true });
        res.cookies.set(PAINEL_COOKIE_NAME, "dev_authorized", {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
        return res;
      }
      return NextResponse.json(
        { ok: false, error: "PAINEL_SENHA não configurada no servidor." },
        { status: 500 },
      );
    }

    if (pass === PAINEL_SENHA) {
      const hash = await hashPassword(PAINEL_SENHA);
      const res = NextResponse.json({ ok: true, authenticated: true });
      res.cookies.set(PAINEL_COOKIE_NAME, hash, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    return NextResponse.json(
      { ok: false, error: "Senha incorreta." },
      { status: 401 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro interno no servidor de autenticação." },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    requiresPassword: hasPasswordConfigured(),
  });
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true, message: "Sessão encerrada." });
  res.cookies.set(PAINEL_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
