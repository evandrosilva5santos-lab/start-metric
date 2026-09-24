"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PerformanceResultsView } from "@/components/dashboard/PerformanceResultsView";
import { readSnapshot, writeSnapshot, type PerformanceSnapshot } from "@/lib/dashboard/snapshot";

const subscribe = () => () => {};

/**
 * Últimos números da visita anterior, mostrados enquanto os novos chegam.
 *
 * Fica fora do <Suspense> de propósito: o React não hidrata o fallback de um
 * Suspense vindo do servidor, então um componente ali dentro nunca rodaria.
 * A troca é por CSS (globals.css): este bloco esconde o esqueleto e some
 * sozinho quando o bloco [data-perf-live] entra na página.
 */
export function PerformanceSnapshotPreview({
  storageKey,
  filtersKey,
}: {
  storageKey: string;
  filtersKey: string;
}) {
  // No servidor não há cópia (null); no navegador lê assim que hidrata.
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const snapshot = raw ? readSnapshot(storageKey, filtersKey) : null;
  if (!snapshot) return null;

  return (
    <div data-perf-snapshot>
      <PerformanceResultsView
        kpis={snapshot.kpis}
        campaigns={snapshot.campaigns}
        generatedAt={snapshot.generatedAt}
        stale
      />
    </div>
  );
}

/** Guarda os números que acabaram de chegar para abrir rápido na próxima vez. */
export function PerformanceSnapshotWriter({
  storageKey,
  snapshot,
}: {
  storageKey: string;
  snapshot: Omit<PerformanceSnapshot, "v" | "savedAt">;
}) {
  useEffect(() => {
    writeSnapshot(storageKey, snapshot);
  }, [storageKey, snapshot]);

  return null;
}
