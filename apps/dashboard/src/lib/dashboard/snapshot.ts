import type { DashboardCampaignRow, DashboardKpis } from "./types";

/**
 * Cópia local dos últimos números que a tela mostrou. Serve só para abrir a
 * tela na hora, no próximo acesso, enquanto os números novos chegam.
 * Guarda apenas métricas; nada de token, chave ou id de conta de anúncios.
 */
export type PerformanceSnapshot = {
  v: 1;
  filtersKey: string;
  savedAt: string;
  generatedAt: string;
  range: { from: string; to: string };
  kpis: DashboardKpis;
  campaigns: DashboardCampaignRow[];
};

const PREFIX = "sm:perf:";
const MAX_CAMPAIGNS = 100;

export function snapshotStorageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function readSnapshot(storageKey: string, filtersKey: string): PerformanceSnapshot | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PerformanceSnapshot;
    if (parsed?.v !== 1 || parsed.filtersKey !== filtersKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSnapshot(storageKey: string, snapshot: Omit<PerformanceSnapshot, "v" | "savedAt">) {
  try {
    const value: PerformanceSnapshot = {
      ...snapshot,
      v: 1,
      savedAt: new Date().toISOString(),
      campaigns: snapshot.campaigns.slice(0, MAX_CAMPAIGNS),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Armazenamento cheio ou bloqueado: a tela funciona sem a cópia.
  }
}

export function clearSnapshots() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nada a limpar.
  }
}
