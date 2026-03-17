"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle, Clock, LogOut, RefreshCw, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AlertToast } from "@/components/alerts/AlertToast";
import { AlertsDropdown } from "@/components/alerts/AlertsDropdown";
import { AlertRulesConfig } from "@/components/alerts/AlertRulesConfig";
import { useAlerts } from "@/hooks/useAlerts";
import { useToast } from "@/hooks/useToast";
import type { DashboardData } from "@/lib/dashboard/types";
import { useAppStore } from "@/store/data-store";
import { useAppQuery } from "@/hooks/useAppQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { DashboardFilters } from "./DashboardFilters";
import { KpiGrid } from "./KpiGrid";
import { PerformanceChart } from "./PerformanceChart";
import { PeriodSummary } from "./PeriodSummary";
import { CampaignsTable } from "./CampaignsTable";
import { SkeletonCard, SkeletonChart, SkeletonTable, SkeletonKpi } from "@/components/ui/Skeleton";

type DashboardClientProps = {
  initialData: DashboardData;
};

type DashboardFiltersState = {
  from: string;
  to: string;
  adAccountId: string;
  campaignStatus: string;
  clientId: string;
};

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function buildQueryString(filters: DashboardFiltersState): string {
  return new URLSearchParams({
    from: filters.from,
    to: filters.to,
    adAccountId: filters.adAccountId,
    campaignStatus: filters.campaignStatus,
    clientId: filters.clientId,
  }).toString();
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 lg:gap-5 mb-6 lg:mb-8">
        {/* KPI Skeletons - layout matches KpiGrid */}
        <div className="xl:col-span-6">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-6">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-3">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-3">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-3">
          <SkeletonKpi />
        </div>
        <div className="xl:col-span-3">
          <SkeletonKpi />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
        <SkeletonChart className="xl:col-span-8 h-[410px]" />
        <SkeletonChart className="xl:col-span-4 h-[410px]" />
      </div>
      <SkeletonTable />
    </>
  );
}

function formatRelativeTime(date: string | null): string {
  if (!date) return "nunca sincronizado";

  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins} minuto${diffMins !== 1 ? "s" : ""}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours !== 1 ? "s" : ""}`;
  return `há ${diffDays} dia${diffDays !== 1 ? "s" : ""}`;
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastDismissed, setToastDismissed] = useState<string | null>(null);

  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const alerts = useAlerts();
  const { showToast } = useToast();
  const { fadeInUp, fadeInContent } = useReducedMotion();

  const queryKey = useMemo(
    () => ["dashboard-data", filters.from, filters.to, filters.adAccountId, filters.campaignStatus, filters.clientId],
    [filters.from, filters.to, filters.adAccountId, filters.campaignStatus, filters.clientId],
  );

  const { data, isPending, isFetching, error } = useAppQuery({
    queryKey,
    syncGlobalState: true,
    globalStateKey: "dashboard:main-query",
    queryFn: async (): Promise<DashboardData> => {
      const response = await fetch(`/api/dashboard?${buildQueryString(filters)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Falha ao carregar dashboard");
      return (await response.json()) as DashboardData;
    },
    initialData,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [queryClient]);

  // Sincroniza filtros do servidor com o Zustand no mount para evitar refetch desnecessário
  useEffect(() => {
    const currentFilters = useAppStore.getState().filters;
    const initialFilters = {
      from: initialData.range.from,
      to: initialData.range.to,
      adAccountId: initialData.filters.adAccountId,
      campaignStatus: initialData.filters.campaignStatus,
      clientId: initialData.filters.clientId || "all",
    };

    const hasDiff =
      currentFilters.from !== initialFilters.from ||
      currentFilters.to !== initialFilters.to ||
      currentFilters.adAccountId !== initialFilters.adAccountId ||
      currentFilters.campaignStatus !== initialFilters.campaignStatus ||
      currentFilters.clientId !== initialFilters.clientId;

    if (hasDiff) {
      setFilters(initialFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, setFilters]);

  const toastAlert =
    alerts.latestAlert && toastDismissed !== alerts.latestAlert.id
      ? alerts.latestAlert
      : null;

  const handleDismissToast = useCallback(() => {
    if (alerts.latestAlert) setToastDismissed(alerts.latestAlert.id);
  }, [alerts.latestAlert]);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/meta/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Erro ao sincronizar");
      }

      const { data } = json;
      showToast(
        `Sincronizado: ${data.synced_accounts} conta(s), ${data.synced_campaigns} campanhas`,
        "success"
      );

      // Invalidar query do dashboard para atualizar dados
      await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao sincronizar. Tente novamente.",
        "error"
      );
    } finally {
      setIsSyncing(false);
    }
  }

  if (error) {
    return (
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto min-w-0">
        <div className="glass glass-2 rounded-3xl p-8 border border-red-500/30">
          <h2 className="text-lg font-bold text-red-300 mb-2">Erro ao carregar dados</h2>
          <p className="text-sm text-slate-300">Tente atualizar a página ou ajustar os filtros.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] bg-primary/10 blur-[120px] rounded-full animate-float opacity-50" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[35%] h-[35%] bg-violet-500/10 blur-[120px] rounded-full animate-float-delayed opacity-40" />
        <div className="absolute top-[35%] left-[50%] w-[35%] h-[35%] -translate-x-1/2 bg-emerald-500/10 blur-[130px] rounded-full animate-float opacity-30" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.025] mix-blend-overlay" />
      </div>

      <AlertToast
        alert={toastAlert}
        onMarkRead={alerts.markRead}
        onDismiss={handleDismissToast}
        autoDismissMs={8000}
      />

      <motion.header
        initial={fadeInUp.initial}
        animate={fadeInUp.animate}
        transition={fadeInUp.transition}
        className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between mb-8 px-5 lg:px-7 py-6 lg:py-7 glass glass-2 rounded-[2rem] relative z-10 noise-overlay border-white/10"
      >
        <div className="relative space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse-fast shadow-[0_0_8px_#06b6d4]" />
            <span className="text-[10px] font-black uppercase text-cyan-400/60 tracking-[0.3em]">
              Operacao ativa
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-white via-cyan-100 to-slate-400 bg-clip-text text-transparent tracking-tighter leading-tight">
            {getGreeting(new Date())},{" "}
            <span className="text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              {data?.userProfile?.name?.split(" ")[0].toLowerCase() ?? "equipe"}
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 px-3 py-1.5 shadow-[0_0_22px_rgba(6,182,212,0.15)]">
              <Activity size={12} />
              Dados em tempo real
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 shadow-[0_0_22px_rgba(16,185,129,0.15)]">
              <Sparkles size={12} />
              {data?.campaigns?.length ?? 0} campanhas listadas
            </span>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock size={11} />
              Atualizado {formatRelativeTime(data?.lastSyncedAt ?? null)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <DashboardFilters filterOptions={data?.filterOptions || initialData.filterOptions} />

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={cn(isSyncing && "animate-spin")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar"}
          </button>

          <div className="flex items-center gap-3 ml-auto lg:ml-0">
            <AlertsDropdown
              alerts={alerts.unreadAlerts}
              unreadCount={alerts.unreadCount}
              onMarkRead={alerts.markRead}
              onMarkAllRead={alerts.markAllRead}
              isMarkingAllRead={alerts.isMarkingAllRead}
            />

            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-label="Sair da conta"
              className="glass glass-1 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-60 group border-white/10"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
                {isSigningOut ? "Saindo..." : "Sair"}
              </span>
            </button>
          </div>
        </div>

        <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none opacity-[0.03]">
          <div className="w-full h-[50px] bg-gradient-to-b from-transparent via-cyan-500 to-transparent absolute -top-[50px] animate-scan" />
        </div>
      </motion.header>

      <motion.div
        initial={fadeInContent.initial}
        animate={fadeInContent.animate}
        transition={fadeInContent.transition}
        className={cn(
          "transition-all duration-300 relative z-10",
          isFetching && "opacity-60 grayscale-[0.3]",
        )}
      >
        {isPending ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Badge de qualidade dos dados */}
            {data?.kpis.revenueAttributed === 0 ? (
              <motion.div
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-4"
              >
                <AlertTriangle size={14} />
                Dados de conversão pendentes — sincronize a conta Meta para ver o ROAS real
              </motion.div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
                <CheckCircle size={14} />
                Dados em tempo real — última sincronização {formatRelativeTime(data?.lastSyncedAt ?? null)}
              </div>
            )}

            <KpiGrid kpis={data.kpis} />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
              <div className="xl:col-span-8">
                <PerformanceChart data={data.chart} />
              </div>
              <div className="xl:col-span-4">
                <PeriodSummary kpis={data.kpis} generatedAt={data.generatedAt} />
              </div>
            </div>

            <CampaignsTable campaigns={data.campaigns} />

            <AlertRulesConfig
              rules={alerts.rules}
              campaigns={data.campaigns}
              onCreateRule={alerts.createRule}
              onToggleRule={alerts.toggleRule}
              onDeleteRule={alerts.deleteRule}
              isCreating={alerts.isCreatingRule}
              activeRulesCount={alerts.activeRulesCount}
            />
          </>
        )}
      </motion.div>
    </main>
  );
}
