// Sincroniza as contas Meta ativas em lotes: cada chamada atualiza as mais desatualizadas
// que cabem no tempo da função e devolve quantas ficaram para a próxima rodada.
// Chamado a cada 30 min pelo pg_cron (migration 20261021000100) e uma vez por dia pela Vercel.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { orderSyncQueue, runWithinBudget, syncPresetsFor, type SyncOutcome } from "@/lib/meta/sync-plan";
import {
  createTokenResolver,
  markAccountExpired,
  metaFailureKind,
  syncAccountMetrics,
  type SyncTarget,
} from "@/lib/meta/sync-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const BUDGET_MS = 45_000;
const CONCURRENCY = 3;
const QUEUE_LIMIT = 1000;

type QueuedAccount = SyncTarget & { status: string; last_synced_at: string | null };

function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

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

  const db = createServiceClient();
  const { data, error } = await db
    .from("ad_accounts")
    .select("id, org_id, external_id, token_encrypted, status, last_synced_at")
    .eq("status", "active")
    .eq("platform", "meta")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(QUEUE_LIMIT);

  if (error) {
    console.error("[cron/meta-sync] Erro ao buscar ad_accounts:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const queue = orderSyncQueue<QueuedAccount>(data ?? []);
  const resolveToken = createTokenResolver(db);
  const expiredTokens = new Set<string>();

  async function syncOne(account: QueuedAccount): Promise<SyncOutcome> {
    const resolved = await resolveToken(account);
    if (!resolved) {
      console.warn(`[cron/meta-sync] Conta ${account.external_id} sem token utilizável.`);
      return "error";
    }
    if (expiredTokens.has(resolved.tokenEncrypted)) {
      await markAccountExpired(db, account, null);
      return "expired";
    }
    try {
      await syncAccountMetrics(db, account, resolved.token, syncPresetsFor(account.last_synced_at, new Date()));
      return "synced";
    } catch (err) {
      const kind = metaFailureKind(err);
      if (kind === "expired") {
        expiredTokens.add(resolved.tokenEncrypted);
        await markAccountExpired(db, account, resolved.tokenEncrypted);
      } else {
        console.error(`[cron/meta-sync] Erro na conta ${account.external_id} (${kind}):`, err instanceof Error ? err.message : err);
      }
      return kind;
    }
  }

  const result = await runWithinBudget(queue, {
    budgetMs: BUDGET_MS,
    concurrency: CONCURRENCY,
    now: Date.now,
    worker: syncOne,
  });

  console.log(`[cron/meta-sync] ${JSON.stringify(result)}`);
  return NextResponse.json(result);
}

// A Vercel Cron chama com GET.
export { POST as GET };
