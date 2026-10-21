const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DASH = "—";

export type SyncFailureCode = "expired" | "rate_limited" | "error";

export type SyncFailureInput = {
  status: number;
  code?: SyncFailureCode | string | null;
  error?: string | null;
};

function timeOf(iso: string | null): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : null;
}

export function formatSyncAge(lastSyncedAt: string | null, nowMs: number): string {
  const time = timeOf(lastSyncedAt);
  if (time === null) return DASH;
  const elapsed = nowMs - time;
  if (elapsed < MINUTE_MS) return "agora há pouco";
  if (elapsed < HOUR_MS) return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  const days = Math.floor(elapsed / DAY_MS);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function oldestSync(values: readonly (string | null)[]): string | null {
  let oldest: { iso: string; time: number } | null = null;
  for (const iso of values) {
    const time = timeOf(iso);
    if (iso === null || time === null) continue;
    if (oldest === null || time < oldest.time) oldest = { iso, time };
  }
  return oldest?.iso ?? null;
}

export function syncProgressLabel(current: number, total: number): string {
  return total > 1 ? `Sincronizando ${current} de ${total}…` : "Sincronizando…";
}

export function syncFailureMessage({ status, code, error }: SyncFailureInput): string {
  if (status === 0) return "Sem conexão com o painel. Confira a internet e tente de novo.";
  if (status === 401) return "Sua sessão não permite sincronizar. Entre com seu login e tente de novo.";
  if (status === 404) return "Conta não encontrada ou sem permissão para sincronizar.";
  if (status === 429 || code === "rate_limited") {
    return "A Meta limitou as consultas por alguns minutos. Tente de novo em instantes.";
  }
  if (code === "expired") return "A conexão com a Meta expirou. Reconecte em Integrações → Meta Ads.";
  if (status >= 400 && status < 500 && error) return error;
  return "A sincronização falhou. Tente de novo em alguns minutos.";
}
