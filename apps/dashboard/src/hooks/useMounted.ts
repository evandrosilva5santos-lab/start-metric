import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * useMounted
 * Retorna true apenas após a primeira montagem no cliente usando useSyncExternalStore.
 * Zero-cascading render e estritamente seguro para hidratação no Next.js App Router (React 19).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

