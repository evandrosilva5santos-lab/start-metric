// src/hooks/useMetaSync.ts — Client-side hook
// Encapsula as ações de sync e disconnect de contas Meta Ads.
// Pode ser reutilizado por qualquer componente que precise dessas operações.

"use client";

import { useState, useCallback } from "react";

export type SyncFeedback = {
  type: "success" | "error";
  message: string;
} | null;

export interface AdAccountAction {
  id: string;
  external_id: string;
  name: string | null;
}

export interface SyncResult {
  campaigns: number;
  metrics: number;
}

export function useMetaSync() {
  const [syncingId, setSyncingId]           = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [feedback, setFeedback]             = useState<SyncFeedback>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  /**
   * Dispara um sync de campanhas e métricas para uma conta Meta.
   * Retorna o resultado ou null em caso de erro (error já está em feedback).
   */
  const syncAccount = useCallback(
    async (account: AdAccountAction): Promise<SyncResult | null> => {
      setSyncingId(account.id);
      setFeedback(null);

      try {
        const res = await fetch("/api/meta/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adAccountId: account.external_id }),
        });

        const data = await res.json();

        if (!res.ok) {
          setFeedback({
            type: "error",
            message: data.error ?? "Erro ao sincronizar.",
          });
          // Retorna código especial para TOKEN_EXPIRED para o chamador reagir
          return null;
        }

        const result: SyncResult = data.synced;
        setFeedback({
          type: "success",
          message: `Sincronizado! ${result.campaigns} campanhas · ${result.metrics} dias de métricas.`,
        });
        return result;
      } catch {
        setFeedback({ type: "error", message: "Erro de rede. Tente novamente." });
        return null;
      } finally {
        setSyncingId(null);
      }
    },
    []
  );

  /**
   * Desconecta uma conta Meta (DELETE em /api/meta/disconnect).
   * Retorna true em caso de sucesso.
   */
  const disconnectAccount = useCallback(
    async (account: AdAccountAction): Promise<boolean> => {
      setDisconnectingId(account.id);
      setFeedback(null);

      try {
        const res = await fetch(
          `/api/meta/disconnect?adAccountId=${encodeURIComponent(account.external_id)}`,
          { method: "DELETE" }
        );

        if (res.ok) {
          setFeedback({ type: "success", message: "Conta desconectada com sucesso." });
          return true;
        }

        setFeedback({ type: "error", message: "Erro ao desconectar. Tente novamente." });
        return false;
      } catch {
        setFeedback({ type: "error", message: "Erro de rede. Tente novamente." });
        return false;
      } finally {
        setDisconnectingId(null);
      }
    },
    []
  );

  return {
    syncingId,
    disconnectingId,
    feedback,
    clearFeedback,
    syncAccount,
    disconnectAccount,
  };
}
