"use client";

import { useState } from "react";
import { syncFailureMessage } from "@/lib/meta/sync-feedback";
import { requestAccountSync } from "@/lib/meta/sync-request";
import type { Feedback, LinkedAccountConflict, PanelMetaAccount } from "./types";

type HideResponse = { error?: string; code?: string; linked?: LinkedAccountConflict[] };

type Options = {
  setAccounts: (update: (prev: PanelMetaAccount[]) => PanelMetaAccount[]) => void;
  onChanged: () => void;
};

export function useMetaAccountActions({ setAccounts, onChanged }: Options) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hiding, setHiding] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [linkedConflict, setLinkedConflict] = useState<{ ids: string[]; linked: LinkedAccountConflict[] } | null>(null);

  async function sync(account: PanelMetaAccount) {
    setSyncingId(account.id);
    setFeedback(null);
    const failure = await requestAccountSync(account.external_id);
    setSyncingId(null);
    if (!failure) {
      setFeedback({ type: "success", message: `${account.name ?? account.external_id} sincronizada com a Meta.` });
      onChanged();
      return;
    }
    if (failure.code === "expired") {
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, status: "expired" } : a)));
    }
    setFeedback({ type: "error", message: syncFailureMessage(failure) });
  }

  async function remove(account: PanelMetaAccount) {
    const name = account.name ?? account.external_id;
    const message = `Excluir "${name}" e todo o histórico sincronizado? Para só tirar a conta do painel, use "Remover do painel".`;
    if (!confirm(message)) return;
    setDeletingId(account.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/meta/disconnect?adAccountId=${account.external_id}`, { method: "DELETE" });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
        setFeedback({ type: "success", message: "Conta excluída com sucesso." });
      } else {
        setFeedback({ type: "error", message: "Erro ao excluir. Tente novamente." });
      }
    } catch {
      setFeedback({ type: "error", message: "Erro de rede. Tente novamente." });
    } finally {
      setDeletingId(null);
    }
  }

  async function hide(accountIds: string[], force = false): Promise<boolean> {
    if (accountIds.length === 0) return false;
    setHiding(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/meta/accounts/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds, force }),
      });
      const data = (await res.json().catch(() => ({}))) as HideResponse;
      if (res.status === 409 && data.code === "linked_to_client") {
        setLinkedConflict({ ids: accountIds, linked: data.linked ?? [] });
        return false;
      }
      if (!res.ok) {
        setFeedback({ type: "error", message: data.error ?? "Não deu para remover do painel." });
        return false;
      }
      const removed = new Set(accountIds);
      setAccounts((prev) => prev.filter((a) => !removed.has(a.id)));
      setLinkedConflict(null);
      setFeedback({
        type: "success",
        message:
          accountIds.length === 1
            ? "Conta removida do painel. O histórico continua salvo e você pode adicioná-la de novo."
            : `${accountIds.length} contas removidas do painel. O histórico continua salvo.`,
      });
      onChanged();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Erro de rede. Tente novamente." });
      return false;
    } finally {
      setHiding(false);
    }
  }

  return {
    syncingId,
    deletingId,
    hiding,
    feedback,
    setFeedback,
    linkedConflict,
    dismissConflict: () => setLinkedConflict(null),
    sync,
    remove,
    hide,
  };
}
