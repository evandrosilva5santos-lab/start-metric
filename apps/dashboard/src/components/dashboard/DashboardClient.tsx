"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AlertToast } from "@/components/alerts/AlertToast";
import { AlertsDropdown } from "@/components/alerts/AlertsDropdown";
import { AlertRulesConfig } from "@/components/alerts/AlertRulesConfig";
import { useAlerts } from "@/hooks/useAlerts";
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
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/Skeleton";

type DashboardClientProps = {
  initialData: DashboardData;
};

type DashboardFiltersState = {
  from: string;
  to: string;
  adAccountId: string;
  campaignStatus: string;
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
  }).toString();
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <SkeletonChart className="lg:col-span-2" />
        <SkeletonChart />
      </div>
      <SkeletonTable />
    </>
  );
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [toastDismissed, setToastDismissed] = useState<string | null>(null);

  const filters = useAppStore((state) => state.filters);
  const alerts = useAlerts();
  const { fadeInUp, fadeInContent } = useReducedMotion();

  const queryKey = useMemo(
    () => ["dashboard-data", filters.from, filters.to, filters.adAccountId, filters.campaignStatus],
    [filters.from, filters.to, filters.adAccountId, filters.campaignStatus],
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

  if (error) {
    return (
      <main className="flex-1 p-8 overflow-y-auto min-w-0">
        <div className="glass rounded-2xl p-8 border border-red-500/30">
          <h2 className="text-lg font-bold text-red-300 mb-2">Erro ao carregar dados</h2>
          <p className="text-sm text-slate-300">Tente atualizar a página ou ajustar os filtros.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8 overflow-y-auto min-w-0 relative">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-float opacity-50" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-emerald-500/5 blur-[100px] rounded-full animate-float-delayed opacity-30" />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <AlertToast
        alert={toastAlert}
        onMarkRead={alerts.markRead}
        onDismiss={handleDismissToast}
        autoDismissMs={8000}
      />

      {/* Header */}
      <motion.header
        initial={fadeInUp.initial}
        animate={fadeInUp.animate}
        transition={fadeInUp.transition}
        className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8 px-6 py-8 glass rounded-3xl relative z-10 noise-overlay border-white/5"
      >
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse-fast shadow-[0_0_8px_#06b6d4]" />
            <span className="text-[10px] font-black uppercase text-cyan-400/60 tracking-[0.3em]">
              System Active
            </span>
          </div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-white to-slate-500 bg-clip-text text-transparent tracking-tighter">
            {getGreeting(new Date())},{" "}
            <span className="text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]">Time</span>
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-medium flex items-center gap-2">
            Protocolo de performance iniciado •{" "}
            <span className="text-cyan-400/80 font-bold">
              {data?.metrics?.activeCampaigns || 0} campanhas ativas
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <DashboardFilters filterOptions={data?.filterOptions || initialData.filterOptions} />

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
              className="glass rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all disabled:opacity-60 group"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
                {isSigningOut ? "Shutting down..." : "Exit"}
              </span>
            </button>
          </div>
        </div>

        {/* HUD Scan Line */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none opacity-[0.03]">
          <div className="w-full h-[50px] bg-gradient-to-b from-transparent via-cyan-500 to-transparent absolute -top-[50px] animate-scan" />
        </div>
      </motion.header>

      {/* Content */}
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
            <KpiGrid kpis={data.kpis} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <PerformanceChart data={data.chart} />
              <PeriodSummary kpis={data.kpis} generatedAt={data.generatedAt} />
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
