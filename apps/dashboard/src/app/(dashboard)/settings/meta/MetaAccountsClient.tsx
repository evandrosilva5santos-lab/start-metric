"use client";

// app/settings/meta/MetaAccountsClient.tsx
// Componente client: exibe contas conectadas, feedback de OAuth e ações.
// Estilo Premium: Glassmorphism, Framer Motion e Lucide Icons.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  RefreshCw, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  Info,
  Database,
  Facebook
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  active: { 
    label: "Ativo", 
    className: "bg-success-tint text-success border-success/20",
    icon: CheckCircle2
  },
  expired: { 
    label: "Expirado", 
    className: "bg-warning-tint text-warning border-warning/20",
    icon: Clock
  },
  disconnected: { 
    label: "Desconectado", 
    className: "bg-subtle text-fg-muted border-border-strong",
    icon: AlertCircle
  },
};

export default function MetaAccountsClient({ accounts, flashConnected, flashError }: Props) {
  const router = useRouter();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [localAccounts, setLocalAccounts] = useState<AdAccount[]>(accounts);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Após OAuth bem-sucedido, o upsert pode ainda não ter propagado quando o
  // Server Component renderizou. Aguarda 1.5s e força um re-fetch dos dados.
  useEffect(() => {
    if (!flashConnected) return;
    const timer = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(timer);
  }, [flashConnected, router]);

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

  const expiredCount = localAccounts.filter((account) => account.status === "expired").length;

  return (
    <div className="space-y-8">
      <AnimatePresence mode="wait">
        {/* Flash de sucesso OAuth */}
        {flashConnected && (
          <motion.div 
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="bg-success-tint border border-success/20 rounded-2xl p-4 text-success text-sm flex items-center gap-3 overflow-hidden"
          >
            <CheckCircle2 size={18} className="shrink-0" />
            <span className="font-bold">Conta Meta conectada com sucesso!</span>
            <span className="text-success">Suas campanhas já estão sendo sincronizadas.</span>
          </motion.div>
        )}

        {/* Flash de erro OAuth */}
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="bg-danger-tint border border-danger/20 rounded-2xl p-4 text-danger text-sm flex items-center gap-3 overflow-hidden"
          >
            <AlertCircle size={18} className="shrink-0" />
            <span className="font-bold">Erro de Conexão:</span>
            <span>{errorMessage}</span>
          </motion.div>
        )}

        {/* Feedback de ações (Sync/Disconnect) */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl p-4 text-sm flex items-center gap-3 shadow-2xl ${
              feedback.type === "success"
                ? "bg-success-tint border border-success/20 text-success"
                : "bg-danger-tint border border-danger/20 text-danger"
            }`}
          >
            {feedback.type === "success" ? <Info size={18} /> : <AlertCircle size={18} />}
            <span className="font-semibold">{feedback.message}</span>
            <button 
              onClick={() => setFeedback(null)}
              className="ml-auto text-xs opacity-50 hover:opacity-100 transition-opacity uppercase tracking-tighter font-black"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {expiredCount > 0 && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-panel border border-warning/30 bg-warning-tint p-4 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-fg">
              <span className="font-semibold">
                {expiredCount === 1 ? "1 conta está" : `${expiredCount} contas estão`} com a conexão da Meta vencida.
              </span>{" "}
              <span className="text-fg-muted">
                Uma única reconexão renova o acesso de todas as contas que o seu usuário da Meta enxerga.
              </span>
            </p>
          </div>
          <a
            href="/api/meta/oauth"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Reconectar todas
          </a>
        </div>
      )}

      {/* Action Area */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary rounded-[22px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
        <a
          href="/api/meta/oauth"
          className="relative flex items-center justify-center gap-3 w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-fg font-black text-sm uppercase tracking-widest hover:translate-y-[-2px] transition-all duration-300 shadow-xl"
        >
          <Plus size={18} strokeWidth={3} />
          {localAccounts.length > 0 ? "Adicionar Novo Gerenciador" : "Vincular Conta Meta Ads"}
        </a>
      </div>

      {/* Accounts Pipeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[12px] font-black text-fg-muted uppercase tracking-[0.2em] flex items-center gap-2">
            <Facebook size={12} className="text-primary" />
            Connections ({localAccounts.length})
          </h2>
          <div className="h-[1px] flex-1 mx-4 bg-subtle" />
          <span className="text-[12px] font-bold text-fg-muted uppercase tracking-tighter">Live Monitor</span>
        </div>

        <div className="grid gap-4">
          {localAccounts.length > 0 ? (
            localAccounts.map((account, index) => {
              const config = STATUS_CONFIG[account.status] ?? STATUS_CONFIG.disconnected;
              const StatusIcon = config.icon;
              const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
              const isExpired = expiresAt ? expiresAt < new Date() : false;
              const isSyncing = syncingId === account.id;

              return (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.01 }}
                  className="group/card relative overflow-hidden p-[1px] rounded-[24px] bg-gradient-to-br from-surface to-surface hover:from-primary-tint hover:to-primary-tint transition-all duration-500"
                >
                  <div className="bg-surface p-6 rounded-[23px] flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-2xl bg-subtle border border-border flex items-center justify-center text-fg-muted group-hover/card:text-primary group-hover/card:border-primary/30 transition-all duration-500">
                          <Database size={24} />
                        </div>
                        {isSyncing && (
                          <div className="absolute inset-0 rounded-2xl border-2 border-primary animate-ping opacity-20" />
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-black text-fg text-base tracking-tight">
                            {account.name ?? account.external_id}
                          </h3>
                          <div className={`px-2 py-0.5 rounded-lg border flex items-center gap-1.5 text-[12px] font-black uppercase tracking-wider ${config.className}`}>
                            <StatusIcon size={10} strokeWidth={3} />
                            {config.label}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-fg-muted tracking-tighter">
                          <span className="flex items-center gap-1">
                            <Info size={12} className="text-fg-muted" />
                            {account.external_id}
                          </span>
                          {account.currency && (
                            <span className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-subtle" />
                              {account.currency}
                            </span>
                          )}
                          {expiresAt && (
                            <span className={`flex items-center gap-1 ${isExpired ? "text-warning" : "text-fg-muted"}`}>
                              <span className="w-1 h-1 rounded-full bg-subtle" />
                              <Clock size={12} />
                              {isExpired ? "Expirou em " : "Expira em "}
                              {expiresAt.toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-border">
                        {account.status === "expired" ? (
                          <a
                            href="/api/meta/oauth"
                            className="flex items-center gap-2 h-10 px-5 rounded-lg bg-warning-tint hover:bg-warning/90 text-warning hover:text-primary-fg transition-all duration-300 text-[12px] font-black uppercase tracking-widest border border-warning/20"
                          >
                            <RefreshCw size={14} strokeWidth={3} />
                            Revalidar
                          </a>
                        ) : (
                          <button
                            onClick={() => handleSync(account)}
                            disabled={isSyncing}
                            className={`flex items-center gap-2 h-10 px-5 rounded-lg transition-all duration-300 text-[12px] font-black uppercase tracking-widest overflow-hidden relative group/btn ${
                              isSyncing
                                ? "bg-primary-tint text-primary cursor-not-allowed"
                                : "bg-subtle hover:bg-primary-hover hover:text-primary-fg text-primary-fg border border-border"
                            }`}
                          >
                            <RefreshCw size={14} strokeWidth={3} className={isSyncing ? "animate-spin" : "group-hover/btn:rotate-180 transition-transform duration-700"} />
                            {isSyncing ? "Syncing..." : "Sincronizar"}
                            
                            {/* Shimmer overlay only when syncing */}
                            {isSyncing && (
                              <motion.div 
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-surface to-transparent"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                              />
                            )}
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDisconnect(account)}
                          disabled={disconnectingId === account.id}
                          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-danger-tint text-fg-muted hover:text-danger transition-all duration-300 group/trash disabled:opacity-50"
                          title="Remover conexão"
                        >
                          {disconnectingId === account.id ? (
                            <RefreshCw size={14} className="animate-spin text-danger" />
                          ) : (
                            <Trash2 size={16} className="group-hover/trash:scale-110 transition-transform" />
                          )}
                        </button>
                      </div>
                      
                      <div className="w-[1px] h-8 bg-subtle mx-2 hidden md:block" />
                      
                      <a 
                        href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.external_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface border border-border text-fg-muted hover:text-fg hover:border-border transition-all"
                        title="Abrir Ads Manager"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                  
                  {/* Background flare on hover */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-tint blur-[60px] opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none" />
                </motion.div>
              );
            })
          ) : (
            !flashConnected && !errorMessage && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 px-6 rounded-[32px] border border-dashed border-border bg-subtle relative overflow-hidden group"
              >
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-3xl bg-subtle flex items-center justify-center text-fg-muted mb-6 group-hover:scale-110 group-hover:bg-primary-tint group-hover:text-primary transition-all duration-700">
                    <Facebook size={32} />
                  </div>
                  <h3 className="text-sm font-black text-fg-muted uppercase tracking-widest mb-2">Sem Conexões Ativas</h3>
                  <p className="text-fg-muted text-xs font-bold max-w-xs mx-auto leading-relaxed">
                    Vincule seu Gerenciador de Anúncios da Meta para começar a monitorar ROI e performance em tempo real.
                  </p>
                </div>
                
                {/* Decorative particles */}
                <div className="absolute top-4 left-4 w-1 h-1 rounded-full bg-subtle" />
                <div className="absolute bottom-10 right-10 w-2 h-2 rounded-full bg-subtle opacity-20" />
              </motion.div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
