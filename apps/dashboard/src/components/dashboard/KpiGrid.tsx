"use client";

import { TrendingUp, MousePointerClick, Eye, DollarSign, Sparkles } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/utils";
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
  const cards = [
    {
      title: "Investimento",
      value: formatCurrency(kpis.adSpend),
      trend: { value: "Período", isPositive: true, label: "" },
      icon: DollarSign,
      color: "#22d3ee",
      className: "xl:col-span-6",
    },
    {
      title: "Receita Atribuída",
      value: formatCurrency(kpis.revenueAttributed),
      trend: { value: "Período", isPositive: true, label: "" },
      icon: TrendingUp,
      color: "#34d399",
      className: "xl:col-span-6",
    },
    {
      title: "Lucro Bruto",
      value: formatCurrency(kpis.grossProfit),
      trend: { value: "Receita - Gasto", isPositive: kpis.grossProfit >= 0, label: "" },
      icon: TrendingUp,
      color: "#34d399",
      className: "xl:col-span-3",
    },
    {
      title: "ROAS",
      value: `${kpis.roas.toFixed(2)}x`,
      trend: { value: "Revenue / Spend", isPositive: kpis.roas >= 1, label: "" },
      icon: Eye,
      color: "#f59e0b",
      className: "xl:col-span-3",
    },
    {
      title: "CPA",
      value: formatCurrency(kpis.cpa),
      trend: { value: "Spend / Conversions", isPositive: true, label: "" },
      icon: MousePointerClick,
      color: "#818cf8",
      className: "xl:col-span-3",
    },
    {
      title: "Conversões",
      value: kpis.attributedConversions.toLocaleString("pt-BR"),
      trend: { value: "Atribuídas", isPositive: true, label: "" },
      icon: Sparkles,
      color: "#38bdf8",
      className: "xl:col-span-3",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4 lg:gap-5 mb-6 lg:mb-8">
      {cards.map((card, index) => (
        <StatCard
          key={card.title}
          title={card.title}
          value={card.value}
          trend={card.trend}
          icon={card.icon}
          color={card.color}
          delay={index * 0.06}
          className={cn("sm:col-span-1", card.className)}
        />
      ))}
    </div>
  );
}
