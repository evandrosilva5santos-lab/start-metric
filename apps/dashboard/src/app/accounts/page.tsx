"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  Wallet,
  Settings,
  LogOut,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
    badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    dot: "bg-emerald-400 animate-pulse",
    Icon: CheckCircle2,
  },
  red: {
    badge: "bg-red-500/10 text-red-400 border border-red-500/20",
    dot: "bg-red-400",
    Icon: XCircle,
  },
  yellow: {
    badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    dot: "bg-amber-400 animate-pulse",
    Icon: Clock,
  },
  gray: {
    badge: "bg-slate-700/50 text-slate-500 border border-slate-700/50",
    dot: "bg-slate-600",
    Icon: AlertCircle,
  },
};

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",       href: "/"           },
  { icon: TrendingUp,      label: "Performance Ads", href: "/performance" },
  { icon: Activity,        label: "Criativos",       href: "/criativos"  },
  { icon: Wallet,          label: "Contas Meta",      href: "/accounts", active: true },
  { icon: Settings,        label: "Integrações",     href: "/settings"   },
];

// ── Skeleton ─────────────────────────────────────────────────────────────────

function AccountSkeleton() {
  return (
    <div className="glass rounded-2xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-slate-800 rounded-lg w-3/5" />
          <div className="h-3 bg-slate-800/60 rounded w-2/5" />
        </div>
        <div className="h-6 w-20 bg-slate-800 rounded-full ml-4" />
      </div>
      <div className="h-3 bg-slate-800/40 rounded w-1/3 mb-5" />
      <div className="h-9 bg-slate-800/60 rounded-xl" />
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
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="flex min-h-screen text-slate-200">
      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside className="w-64 h-screen sticky top-0 glass-solid border-r flex flex-col p-4 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center text-cyan-400 font-bold text-xs tracking-widest">
            SM
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">
            START METRIC
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map(({ icon: Icon, label, href, active }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                active
                  ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 font-semibold"
                  : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Icon size={18} />
              {label}
              {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800/60 pt-4 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-slate-900 font-bold text-xs shrink-0">
              EV
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">Evandro Santos</p>
              <p className="text-[10px] text-slate-600 truncate">gestor@agencia.com</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-all duration-200 border border-transparent disabled:opacity-60"
          >
            <LogOut size={16} />
            {isSigningOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────── */}
      <main className="flex-1 p-8 overflow-y-auto min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
            <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-1">
              Meta Ads
            </p>
            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
              Contas de Anúncios
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              id="btn-sync"
              onClick={() => fetchAccounts(true)}
              disabled={syncing || loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-400/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
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
            className="flex flex-col items-center justify-center py-24 text-slate-600"
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
                    className="glass rounded-2xl p-5 flex flex-col gap-4 hover:border-slate-600/60 transition-all duration-300 group"
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-cyan-100 transition-colors">
                          {account.name}
                        </h3>
                        <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                          ID: {account.id}
                        </p>
                      </div>

                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                        {status.label}
                      </span>
                    </div>

                    {/* Currency */}
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <StatusIcon size={13} />
                      <span>Moeda: <span className="text-slate-400 font-semibold">{account.currency}</span></span>
                    </div>

                    {/* CTA */}
                    <button
                      id={`btn-metrics-${account.id}`}
                      onClick={() => router.push(`/insights?account_id=${account.id}`)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-300 font-semibold hover:bg-cyan-400/10 hover:border-cyan-400/25 hover:text-cyan-300 transition-all duration-200 mt-auto"
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
    </div>
  );
}
