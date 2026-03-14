"use client";

// app/settings/meta/MetaAccountsClient.tsx
// Componente client: exibe contas conectadas, feedback de OAuth e ações.

import { useState } from "react";

interface AdAccount {
  id: string;
  name: string | null;
  external_id: string;
  status: string;
  currency: string | null;
  connected_at: string | null;
  token_expires_at: string | null;
}

interface Props {
  accounts: AdAccount[];
  flashConnected?: boolean;
  flashError?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Você cancelou a conexão com a Meta.",
  missing_params: "Parâmetros inválidos. Tente novamente.",
  invalid_state: "Sessão expirou. Tente novamente.",
  unauthenticated: "Sessão expirou. Faça login novamente.",
  no_organization: "Sua conta não está associada a uma organização.",
  no_ad_accounts: "Nenhuma conta de anúncios encontrada neste perfil Meta.",
  save_failed: "Erro ao salvar a conexão. Tente novamente.",
  unexpected: "Erro inesperado. Tente novamente em instantes.",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  expired: { label: "Expirado", className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  disconnected: { label: "Desconectado", className: "bg-gray-500/15 text-gray-400 border border-gray-500/30" },
};

export default function MetaAccountsClient({ accounts, flashConnected, flashError }: Props) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [localAccounts, setLocalAccounts] = useState<AdAccount[]>(accounts);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const errorMessage = flashError ? ERROR_MESSAGES[flashError] ?? "Erro ao conectar. Tente novamente." : null;

  async function handleSync(account: AdAccount) {
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
        if (data.code === "TOKEN_EXPIRED") {
          setLocalAccounts((prev) =>
            prev.map((a) => (a.id === account.id ? { ...a, status: "expired" } : a))
          );
          setFeedback({ type: "error", message: "Token expirado. Reconecte sua conta." });
        } else {
          setFeedback({ type: "error", message: data.error ?? "Erro ao sincronizar." });
        }
      } else {
        setFeedback({
          type: "success",
          message: `Sincronizado! ${data.synced.campaigns} campanhas · ${data.synced.metrics} métricas.`,
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Erro de rede. Tente novamente." });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDisconnect(account: AdAccount) {
    if (!confirm(`Desconectar "${account.name ?? account.external_id}"? Esta ação removerá o acesso.`)) return;
    setDisconnectingId(account.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/meta/disconnect?adAccountId=${account.external_id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLocalAccounts((prev) => prev.filter((a) => a.id !== account.id));
        setFeedback({ type: "success", message: "Conta desconectada com sucesso." });
      } else {
        setFeedback({ type: "error", message: "Erro ao desconectar. Tente novamente." });
      }
    } catch {
      setFeedback({ type: "error", message: "Erro de rede. Tente novamente." });
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Flash de sucesso OAuth */}
      {flashConnected && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 text-sm flex items-start gap-3">
          <span className="text-lg leading-none">✓</span>
          <span>Conta Meta conectada com sucesso! Suas campanhas já estão sendo sincronizadas.</span>
        </div>
      )}

      {/* Flash de erro OAuth */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-start gap-3">
          <span className="text-lg leading-none">✕</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Feedback de ações */}
      {feedback && (
        <div
          className={`rounded-xl p-4 text-sm flex items-start gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          <span className="text-lg leading-none">{feedback.type === "success" ? "✓" : "✕"}</span>
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Botão conectar */}
      <a
        href="/api/meta/oauth"
        className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors font-semibold text-white"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        {localAccounts.length > 0 ? "Conectar outra conta Meta" : "Conectar conta Meta Ads"}
      </a>

      {/* Lista de contas */}
      {localAccounts.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Contas conectadas ({localAccounts.length})
          </h2>
          {localAccounts.map((account) => {
            const badge = STATUS_BADGE[account.status] ?? STATUS_BADGE.disconnected;
            const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
            const isExpired = expiresAt ? expiresAt < new Date() : false;

            return (
              <div
                key={account.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{account.name ?? account.external_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    ID: {account.external_id}
                    {account.currency && ` · ${account.currency}`}
                    {expiresAt && (
                      <span className={isExpired ? " · text-amber-400" : ""}>
                        {" "}· {isExpired ? "Token expirou em " : "Expira em "}
                        {expiresAt.toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  {account.status === "expired" ? (
                    <a
                      href="/api/meta/oauth"
                      className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors"
                    >
                      Reconectar
                    </a>
                  ) : (
                    <button
                      onClick={() => handleSync(account)}
                      disabled={syncingId === account.id}
                      className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {syncingId === account.id ? "Sincronizando…" : "Sincronizar"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDisconnect(account)}
                    disabled={disconnectingId === account.id}
                    className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/20"
                  >
                    {disconnectingId === account.id ? "Removendo…" : "Desconectar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !flashConnected && !errorMessage && (
          <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
            <p className="text-gray-500 text-sm">Nenhuma conta conectada ainda.</p>
            <p className="text-gray-600 text-xs mt-1">
              Clique em &quot;Conectar conta Meta Ads&quot; acima para começar.
            </p>
          </div>
        )
      )}
    </div>
  );
}
