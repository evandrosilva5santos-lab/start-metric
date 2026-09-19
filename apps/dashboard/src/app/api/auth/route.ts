import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a ?? ""), "utf8");
  const bufB = Buffer.from(String(b ?? ""), "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const pass = body.password || "";

    if (DASHBOARD_PASSWORD && safeEqual(pass, DASHBOARD_PASSWORD)) {
      return NextResponse.json({ ok: true, authenticated: true });
    }

    return NextResponse.json({ ok: false, error: "Senha incorreta." }, { status: 401 });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: "Erro ao processar autenticação." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ requiresPassword: Boolean(DASHBOARD_PASSWORD) });
}
