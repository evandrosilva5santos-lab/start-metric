// Revisita diariamente, com o scraper próprio, as ofertas aprovadas (watch = true).
// Protegido por Authorization: Bearer {CRON_SECRET} (a Vercel envia sozinha quando a variável existe).

import { NextResponse } from "next/server";
import { createGarimpoServiceClient } from "@/lib/garimpo/service-client";
import { runWatchForOrg } from "@/lib/garimpo/watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

// Só o segredo: o cabeçalho x-vercel-cron pode ser forjado por qualquer um.
function isCronAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  return token === CRON_SECRET;
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createGarimpoServiceClient();
  const { data: watched, error } = await supabase.from("garimpo_offers").select("org_id").eq("watch", true);
  if (error) {
    console.error("[cron/garimpo-watch] Erro ao buscar ofertas vigiadas:", error.message);
    return NextResponse.json({ error: "Falha ao buscar ofertas vigiadas" }, { status: 500 });
  }

  const orgIds = [...new Set((watched ?? []).map((o) => o.org_id))];
  const results = { orgs: orgIds.length, ok: 0, blocked: 0, failed: 0 };

  for (const orgId of orgIds) {
    try {
      const summary = await runWatchForOrg(supabase, orgId);
      if (!summary) continue;
      if (summary.status === "ok") results.ok++;
      else if (summary.status === "blocked") {
        results.blocked++;
        // Bloqueado: parar aqui e não insistir com as outras organizações.
        break;
      } else results.failed++;
    } catch (e) {
      results.failed++;
      console.error("[cron/garimpo-watch] Falha na organização:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json(results);
}

export { POST as GET };
