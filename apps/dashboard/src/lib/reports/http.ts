import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";
import { getDashboardSession, type DashboardSession } from "@/lib/auth/session";
import type { ReportsDb } from "@/lib/reports/data";

export interface ReportsSession {
  orgId: string;
  db: ReportsDb;
  userId: string | null;
  isPainel: boolean;
}

type Result<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function jsonError(status: number, error: string, details?: unknown): NextResponse {
  return NextResponse.json(details === undefined ? { error } : { error, details }, { status });
}

export function serverError(context: string, err: unknown): NextResponse {
  console.error(`[api/reports] ${context}:`, err instanceof Error ? err.message : err);
  return jsonError(500, "Erro interno ao processar relatórios.");
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export async function requireReportsSession(): Promise<Result<ReportsSession>> {
  const session: DashboardSession = await getDashboardSession();
  if (!session.isAuthorized || !session.orgId || !session.supabase) {
    return { ok: false, response: jsonError(401, "Não autorizado") };
  }
  return {
    ok: true,
    value: {
      orgId: session.orgId,
      db: session.supabase as ReportsDb,
      userId: session.isPainel ? null : (session.user?.id ?? null),
      isPainel: session.isPainel,
    },
  };
}

export async function readJson<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<Result<z.output<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: jsonError(400, "Corpo da requisição não é JSON válido") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: jsonError(400, "Dados inválidos", parsed.error.issues) };
  }
  return { ok: true, value: parsed.data };
}

export async function readIdParam(params: Promise<{ id: string }>): Promise<Result<string>> {
  const { id } = await params;
  if (!isUuid(id)) return { ok: false, response: jsonError(400, "ID inválido") };
  return { ok: true, value: id };
}
