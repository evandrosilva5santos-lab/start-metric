"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  formatSyncAge,
  oldestSync,
  syncFailureMessage,
  syncProgressLabel,
  type SyncFailureInput,
} from "@/lib/meta/sync-feedback";
import { requestAccountSync } from "@/lib/meta/sync-request";

export type SyncScopeAccount = { externalId: string; name: string; lastSyncedAt: string | null };

type Variant = "primary" | "inline";
type RunState =
  | { phase: "idle" }
  | { phase: "running"; current: number; total: number }
  | { phase: "done"; tone: "success" | "error"; message: string };

const AGE_TICK_MS = 60_000;
const STOP_STATUSES = new Set([0, 401, 429]);
const STOP_CODES = new Set(["expired", "rate_limited"]);

const BUTTON_CLASS: Record<Variant, string> = {
  primary:
    "inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-70 lg:h-9",
  inline:
    "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:underline disabled:opacity-70 disabled:no-underline",
};

function summary(synced: number, total: number, failure: SyncFailureInput | null): RunState {
  if (!failure) return { phase: "done", tone: "success", message: "Dados atualizados com a Meta." };
  const message = syncFailureMessage(failure);
  if (synced === 0) return { phase: "done", tone: "error", message };
  return { phase: "done", tone: "error", message: `${synced} de ${total} contas atualizadas. ${message}` };
}

export function SyncNowButton({
  accounts,
  variant = "inline",
  label = "Sincronizar agora",
  secondary,
}: {
  accounts: SyncScopeAccount[];
  variant?: Variant;
  label?: string;
  secondary?: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<RunState>({ phase: "idle" });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const running = state.phase === "running";
  const age = formatSyncAge(oldestSync(accounts.map((account) => account.lastSyncedAt)), nowMs);

  async function run() {
    const total = accounts.length;
    let synced = 0;
    let firstFailure: SyncFailureInput | null = null;
    for (const [index, account] of accounts.entries()) {
      setState({ phase: "running", current: index + 1, total });
      const failure = await requestAccountSync(account.externalId);
      if (!failure) {
        synced += 1;
        continue;
      }
      firstFailure ??= failure;
      if (STOP_STATUSES.has(failure.status) || STOP_CODES.has(String(failure.code))) break;
    }
    setNowMs(Date.now());
    setState(summary(synced, total, firstFailure));
    if (synced > 0) router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={run}
        disabled={running || accounts.length === 0}
        aria-busy={running}
        className={BUTTON_CLASS[variant]}
      >
        <RefreshCw size={variant === "primary" ? 15 : 13} aria-hidden="true" className={running ? "animate-spin" : undefined} />
        {state.phase === "running" ? syncProgressLabel(state.current, state.total) : label}
      </button>
      {secondary}
      <span className="text-xs tabular-nums text-text-secondary" suppressHydrationWarning>
        {age === "—" ? "Atualizado: —" : `Atualizado ${age}`}
      </span>
      <p
        role="status"
        aria-live="polite"
        className={`basis-full text-xs ${state.phase === "done" && state.tone === "error" ? "text-warning" : "text-text-secondary"} ${
          state.phase === "done" ? "" : "sr-only"
        }`}
      >
        {state.phase === "done" ? state.message : ""}
      </p>
    </div>
  );
}
