"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface MetaAccount {
  id: string;
  name: string;
  currency: string;
  is_active: boolean;
  account_status?: number;
}

// 1 = ACTIVE | 2 = DISABLED | 3 = UNSETTLED | 7 = PENDING_RISK_REVIEW
// 8 = PENDING_SETTLEMENT | 9 = IN_GRACE_PERIOD | 100 = PENDING_CLOSURE
// 101 = CLOSED | 201 = ANY_ACTIVE | 202 = ANY_CLOSED
function resolveStatus(account: MetaAccount): {
  label: string;
  color: "green" | "red" | "yellow" | "gray";
} {
  if (account.account_status === 1 || account.is_active) {
    return { label: "Ativo", color: "green" };
  }
  if (account.account_status === 2 || account.account_status === 101) {
    return { label: "Desativado", color: "red" };
  }
  if (
    account.account_status === 3 ||
    account.account_status === 8 ||
    account.account_status === 9
  ) {
    return { label: "Pendente", color: "yellow" };
  }
  return { label: "Inativo", color: "gray" };
}

const STATUS_STYLES = {
  green: {
    badge: "bg-success-tint text-success border border-success/20",
    dot: "bg-success animate-pulse",
    Icon: CheckCircle2,
  },
  red: {
    badge: "bg-danger-tint text-danger border border-danger/20",
    dot: "bg-danger",
    Icon: XCircle,
  },
  yellow: {
    badge: "bg-warning-tint text-warning border border-warning/20",
    dot: "bg-warning animate-pulse",
    Icon: Clock,
  },
  gray: {
    badge: "bg-subtle text-fg-muted border border-border",
    dot: "bg-border-strong",
    Icon: AlertCircle,
  },
};

// ── Skeleton ─────────────────────────────────────────────────────────────────

function AccountSkeleton() {
  return (
    <div className="glass rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-subtle rounded-lg w-3/5" />
          <div className="h-3 bg-subtle rounded w-2/5" />
        </div>
        <div className="h-6 w-20 bg-subtle rounded-full ml-4" />
      </div>
      <div className="h-3 bg-subtle rounded w-1/3 mb-5" />
      <div className="h-9 bg-subtle rounded-xl" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchAccounts = useCallback(async (showSyncSpinner = false) => {
    if (showSyncSpinner) setSyncing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/meta/accounts");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Erro ${res.status}`);
      }
      const data: MetaAccount[] = await res.json();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar contas.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  return (
    <>
      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main className="flex-1 p-8 overflow-y-auto min-w-0">
        {/* Header */}
        <header className="flex items-center gap-4 mb-10">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            <p className="text-[12px] text-primary uppercase tracking-[0.2em] font-semibold mb-1">
              Meta Ads
            </p>
            <h1 className="text-3xl font-extrabold text-fg tracking-tight leading-none">
              Contas de Anúncios
            </h1>
          </motion.div>

          {/* Sync Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              id="btn-sync"
              onClick={() => fetchAccounts(true)}
              disabled={syncing || loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-tint border border-primary/20 text-primary text-sm font-semibold hover:bg-primary-tint transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
          </motion.div>
        </header>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-danger-tint border border-danger/20 text-danger text-sm"
            >
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <AccountSkeleton />
              </motion.div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-fg-muted"
          >
            <Wallet size={40} className="mb-4 opacity-30" />
            <p className="text-sm font-medium">Nenhuma conta encontrada.</p>
            <p className="text-xs mt-1 opacity-60">
              Conecte uma conta Meta em Integrações.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <AnimatePresence>
              {accounts.map((account, i) => {
                const status = resolveStatus(account);
                const { badge, dot, Icon: StatusIcon } = STATUS_STYLES[status.color];

                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.07, type: "spring", stiffness: 260, damping: 22 }}
                    className="glass rounded-2xl p-5 flex flex-col gap-4 hover:border-border-strong transition-all duration-300 group"
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-fg truncate group-hover:text-primary transition-colors">
                          {account.name}
                        </h3>
                        <p className="text-[12px] text-fg-muted mt-0.5 font-mono">
                          ID: {account.id}
                        </p>
                      </div>

                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider shrink-0 ${badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {status.label}
                      </span>
                    </div>

                    {/* Currency */}
                    <div className="flex items-center gap-2 text-xs text-fg-muted">
                      <StatusIcon size={13} />
                      <span>Moeda: <span className="text-fg-muted font-semibold">{account.currency}</span></span>
                    </div>

                    {/* CTA */}
                    <button
                      id={`btn-metrics-${account.id}`}
                      onClick={() => router.push(`/insights?account_id=${account.id}`)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-subtle border border-border text-sm text-fg font-semibold hover:bg-primary-tint hover:border-primary/25 hover:text-primary transition-all duration-200 mt-auto"
                    >
                      Ver métricas
                      <ArrowRight size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </>
  );
}
