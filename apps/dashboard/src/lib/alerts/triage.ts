import type { TriageState } from "./types";

export type TriageAction = "acknowledge" | "resolve";

type TriageStamps = {
  acknowledged_at?: string | null;
  resolved_at?: string | null;
};

export const TRIAGE_STATES: readonly TriageState[] = ["open", "acknowledged", "resolved"];

export function triageState(alert: TriageStamps): TriageState {
  if (alert.resolved_at) return "resolved";
  if (alert.acknowledged_at) return "acknowledged";
  return "open";
}

export function transitionError(state: TriageState, action: TriageAction): string | null {
  if (action === "acknowledge") {
    if (state === "open") return null;
    return state === "acknowledged" ? "Alerta já reconhecido." : "Alerta já resolvido.";
  }
  return state === "resolved" ? "Alerta já resolvido." : null;
}

export function acknowledgePatch(alert: { read_at: string | null }, now: Date) {
  const iso = now.toISOString();
  return {
    acknowledged_at: iso,
    status: "read" as const,
    read_at: alert.read_at ?? iso,
  };
}

export function resolvePatch(
  alert: { read_at: string | null; acknowledged_at: string | null },
  note: string,
  now: Date,
) {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("RESOLUTION_NOTE_REQUIRED");
  const iso = now.toISOString();
  return {
    resolved_at: iso,
    resolution_note: trimmed,
    status: "read" as const,
    read_at: alert.read_at ?? iso,
    acknowledged_at: alert.acknowledged_at ?? iso,
  };
}
