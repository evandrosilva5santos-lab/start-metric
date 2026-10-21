// Chamada do navegador para POST /api/meta/sync de uma conta.
// A rota responde 200 mesmo quando a conta falha; a falha vem em data.failures.

import type { SyncFailureInput } from "./sync-feedback";

type SyncPayload = {
  error?: string;
  data?: { failures?: Array<{ code?: string }> };
};

export async function requestAccountSync(externalId: string): Promise<SyncFailureInput | null> {
  let res: Response;
  try {
    res = await fetch("/api/meta/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adAccountId: externalId }),
    });
  } catch {
    return { status: 0 };
  }
  const payload = (await res.json().catch(() => ({}))) as SyncPayload;
  if (!res.ok) return { status: res.status, error: payload.error ?? null };
  const failure = payload.data?.failures?.[0];
  return failure ? { status: res.status, code: failure.code ?? "error" } : null;
}
