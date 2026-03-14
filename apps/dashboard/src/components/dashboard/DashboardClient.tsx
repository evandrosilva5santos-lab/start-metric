"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, TrendingUp, MousePointerClick, Eye, DollarSign } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/ui/StatCard";
import { AlertToast } from "@/components/alerts/AlertToast";
import { AlertsDropdown } from "@/components/alerts/AlertsDropdown";
import { AlertRulesConfig } from "@/components/alerts/AlertRulesConfig";
import { useAlerts } from "@/hooks/useAlerts";
import type { DashboardData } from "@/lib/dashboard/types";

type DashboardClientProps = {
  initialData: DashboardData;
};

type DashboardFiltersState = {
  from: string;
  to: string;
  adAccountId: string;
  campaignStatus: string;
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatDateLabel(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function statusLabel(status: string): string {
  if (status === "ACTIVE") return "Ativa";
  if (status === "PAUSED") return "Pausada";
  if (status === "ARCHIVED") return "Arquivada";
  if (status === "DELETED") return "Deletada";
  return status;
}

function buildQueryString(filters: DashboardFiltersState): string {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    adAccountId: filters.adAccountId,
    campaignStatus: filters.campaignStatus,
  });
  return params.toString();
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="glass rounded-2xl p-5 h-[156px] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="glass rounded-2xl h-[360px] lg:col-span-2 animate-pulse" />
        <div className="glass rounded-2xl h-[360px] animate-pulse" />
      </div>
      <div className="glass rounded-2xl h-[420px] animate-pulse" />
    </>
  );
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [toastDismissed, setToastDismissed] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFiltersState>({
    from: initialData.range.from,
    to: initialData.range.to,
    adAccountId: initialData.filters.adAccountId,
    campaignStatus: initialData.filters.campaignStatus,
  });

  // ─── Alertas (hook dedicado) ────────────────────────────────
  const alerts = useAlerts();

  // ─── Dashboard Data ─────────────────────────────────────────
  const queryKey = useMemo(
    () => ["dashboard-data", filters.from, filters.to, filters.adAccountId, filters.campaignStatus],
    [filters],
  );

  const { data, isPending, isFetching, error } = useQuery({
    queryKey,
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

  // ─── Auto-refresh dashboard ─────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [queryClient]);

  // ─── Toast logic ────────────────────────────────────────────
  const toastAlert = alerts.latestAlert && toastDismissed !== alerts.latestAlert.id
    ? alerts.latestAlert
    : null;

  const handleDismissToast = useCallback(() => {
    if (alerts.latestAlert) {
      setToastDismissed(alerts.latestAlert.id);
    }
  }, [alerts.latestAlert]);

  // ─── Sign out ───────────────────────────────────────────────
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
    <main className="flex-1 p-8 overflow-y-auto min-w-0">
      {/* ─── Toast de Alerta ──────────────────────────────────── */}
      <AlertToast
        alert={toastAlert}
        onMarkRead={alerts.markRead}
        onDismiss={handleDismissToast}
        autoDismissMs={8000}
      />

      {/* ─── Header ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
        <div>
          <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-1">
            Painel Principal
          </p>
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
            Lucro Real por Campanha
          </h1>
          <p className="text-xs text-slate-500 mt-2">
            Timezone da organização: <span className="text-slate-300">{data.timezone}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
            className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
            className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
          <select
            value={filters.adAccountId}
            onChange={(event) => setFilters((prev) => ({ ...prev, adAccountId: event.target.value }))}
            className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="all">Todas as contas</option>
            {data.filterOptions.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select
            value={filters.campaignStatus}
            onChange={(event) => setFilters((prev) => ({ ...prev, campaignStatus: event.target.value }))}
            className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="all">Todos status</option>
            {data.filterOptions.statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>

          {/* ─── Alerts Dropdown ───────────────────────────────── */}
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
            className="glass rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:text-red-400 transition-colors disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <LogOut size={16} />
              {isSigningOut ? "Saindo..." : "Sair"}
            </span>
          </button>
        </div>
      </header>

      {/* ─── Dashboard Content ────────────────────────────────── */}
      {isPending ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
            <StatCard
              title="Investimento"
              value={formatCurrency(data.kpis.adSpend)}
              trend={{ value: "Período", isPositive: true, label: "" }}
              icon={DollarSign}
              color="#22d3ee"
            />
            <StatCard
              title="Receita Atribuída"
              value={formatCurrency(data.kpis.revenueAttributed)}
              trend={{ value: "Período", isPositive: true, label: "" }}
              icon={TrendingUp}
              color="#34d399"
            />
            <StatCard
              title="Lucro Bruto"
              value={formatCurrency(data.kpis.grossProfit)}
              trend={{ value: "Receita - Gasto", isPositive: data.kpis.grossProfit >= 0, label: "" }}
              icon={TrendingUp}
              color="#34d399"
            />
            <StatCard
              title="ROAS"
              value={`${data.kpis.roas.toFixed(2)}x`}
              trend={{ value: "Revenue / Spend", isPositive: data.kpis.roas >= 1, label: "" }}
              icon={Eye}
              color="#f59e0b"
            />
            <StatCard
              title="CPA"
              value={formatCurrency(data.kpis.cpa)}
              trend={{ value: "Spend / Conversions", isPositive: true, label: "" }}
              icon={MousePointerClick}
              color="#818cf8"
            />
          </div>

          {/* Chart + Resumo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 glass rounded-2xl p-6 h-[360px]">
              <h2 className="text-base font-bold text-white mb-1">Curva de Performance</h2>
              <p className="text-xs text-slate-600 mb-5">Spend, Receita e Lucro Bruto por dia</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickFormatter={formatDateLabel}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    tickFormatter={(value) => `R$ ${Math.round(value / 1000)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    labelFormatter={(value) => `Dia ${formatDateLabel(String(value ?? ""))}`}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid rgba(56, 189, 248, 0.2)",
                      borderRadius: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="spend" stroke="#22d3ee" fill="#22d3ee33" name="Gasto" />
                  <Area type="monotone" dataKey="revenue" stroke="#34d399" fill="#34d39933" name="Receita" />
                  <Area type="monotone" dataKey="profit" stroke="#f59e0b" fill="#f59e0b22" name="Lucro" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="glass rounded-2xl p-6 h-[360px]">
              <h2 className="text-base font-bold text-white mb-3">Resumo do Período</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">Impressões</span>
                  <span className="font-semibold text-white">{formatNumber(data.kpis.impressions)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">Cliques</span>
                  <span className="font-semibold text-white">{formatNumber(data.kpis.clicks)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">Conversões atribuídas</span>
                  <span className="font-semibold text-white">{formatNumber(data.kpis.attributedConversions)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-400">ROI</span>
                  <span className="font-semibold text-white">{(data.kpis.roi * 100).toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Atualizado em</span>
                  <span className="font-semibold text-white">
                    {new Date(data.generatedAt).toLocaleTimeString("pt-BR")}
                  </span>
                </div>
              </div>
              {isFetching && (
                <p className="text-xs text-cyan-400/70 mt-4">Atualizando dados...</p>
              )}
            </div>
          </div>

          {/* Tabela de Campanhas */}
          <div className="glass rounded-2xl p-6 min-h-[420px]">
            <h2 className="text-base font-bold text-white mb-5">Campanhas: Gasto, Receita, ROAS e Lucro</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-slate-600 border-b border-slate-800/60">
                    <th className="text-left pb-3 font-semibold">Campanha</th>
                    <th className="text-left pb-3 font-semibold">Conta</th>
                    <th className="text-right pb-3 font-semibold whitespace-nowrap">Gasto</th>
                    <th className="text-right pb-3 font-semibold whitespace-nowrap">Receita</th>
                    <th className="text-right pb-3 font-semibold whitespace-nowrap">ROAS</th>
                    <th className="text-right pb-3 font-semibold whitespace-nowrap">CPA</th>
                    <th className="text-right pb-3 font-semibold whitespace-nowrap">Lucro</th>
                    <th className="text-right pb-3 font-semibold whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {data.campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500 text-xs">
                        Sem campanhas no período/filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    data.campaigns.map((campaign) => (
                      <tr key={campaign.campaignId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 text-slate-200 font-medium">{campaign.campaignName}</td>
                        <td className="py-3.5 text-slate-400">{campaign.accountName}</td>
                        <td className="py-3.5 text-right text-slate-300 text-mono">
                          {formatCurrency(campaign.spend)}
                        </td>
                        <td className="py-3.5 text-right text-slate-300 text-mono">
                          {formatCurrency(campaign.revenue)}
                        </td>
                        <td className="py-3.5 text-right text-emerald-400 font-bold text-mono">
                          {campaign.roas.toFixed(2)}x
                        </td>
                        <td className="py-3.5 text-right text-slate-300 text-mono">
                          {formatCurrency(campaign.cpa)}
                        </td>
                        <td
                          className={`py-3.5 text-right text-mono font-bold ${
                            campaign.grossProfit >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {formatCurrency(campaign.grossProfit)}
                        </td>
                        <td className="py-3.5 text-right">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-slate-700/50 text-slate-300">
                            {statusLabel(campaign.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Alerts Config ─────────────────────────────────── */}
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
    </main>
  );
}
