"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * useHydrated hook for React 19 / Next.js 16 App Router.
 * Returns true only after the component has mounted on the client.
 * Uses useSyncExternalStore to avoid hydration mismatch warnings.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
