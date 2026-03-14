"use client";

import { TrendingUp, MousePointerClick, Eye, DollarSign } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import type { DashboardKpis } from "@/lib/dashboard/types";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type KpiGridProps = {
  kpis: DashboardKpis;
};

export function KpiGrid({ kpis }: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
      <StatCard
        title="Investimento"
        value={formatCurrency(kpis.adSpend)}
        trend={{ value: "Período", isPositive: true, label: "" }}
        icon={DollarSign}
        color="#22d3ee"
      />
      <StatCard
        title="Receita Atribuída"
        value={formatCurrency(kpis.revenueAttributed)}
        trend={{ value: "Período", isPositive: true, label: "" }}
        icon={TrendingUp}
        color="#34d399"
      />
      <StatCard
        title="Lucro Bruto"
        value={formatCurrency(kpis.grossProfit)}
        trend={{ value: "Receita - Gasto", isPositive: kpis.grossProfit >= 0, label: "" }}
        icon={TrendingUp}
        color="#34d399"
      />
      <StatCard
        title="ROAS"
        value={`${kpis.roas.toFixed(2)}x`}
        trend={{ value: "Revenue / Spend", isPositive: kpis.roas >= 1, label: "" }}
        icon={Eye}
        color="#f59e0b"
      />
      <StatCard
        title="CPA"
        value={formatCurrency(kpis.cpa)}
        trend={{ value: "Spend / Conversions", isPositive: true, label: "" }}
        icon={MousePointerClick}
        color="#818cf8"
      />
    </div>
  );
}
