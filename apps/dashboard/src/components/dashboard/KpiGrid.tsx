"use client";

import { Kpi } from "@/components/ui/StatCard";
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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

type KpiGridProps = {
  kpis: DashboardKpis;
};

export function KpiGrid({ kpis }: KpiGridProps) {
  const cards = [
    {
      label: "Investimento",
      value: formatCurrency(kpis.adSpend),
      detail: "Período",
      className: "xl:col-span-6",
    },
    {
      label: "Receita Atribuída",
      value: formatCurrency(kpis.revenueAttributed),
      detail: "Período",
      className: "xl:col-span-6",
    },
    {
      label: "Lucro Bruto",
      value: formatCurrency(kpis.grossProfit),
      detail: "Receita - Gasto",
      className: "xl:col-span-3",
    },
    {
      label: "ROAS",
      value: `${kpis.roas.toFixed(2)}x`,
      detail: "Revenue / Spend",
      className: "xl:col-span-3",
    },
    {
      label: "CPA",
      value: formatCurrency(kpis.cpa),
      detail: "Spend / Conversions",
      className: "xl:col-span-3",
    },
    {
      label: "Conversões",
      value: kpis.attributedConversions.toLocaleString("pt-BR"),
      detail: "Atribuídas",
      className: "xl:col-span-3",
    },
    {
      label: "CPM",
      value: formatCurrency(kpis.cpm),
      detail: "Custo por mil impressões",
      className: "xl:col-span-3",
    },
    {
      label: "CTR",
      value: formatPercent(kpis.ctr),
      detail: "Taxa de cliques",
      className: "xl:col-span-3",
    },
    {
      label: "CPC",
      value: formatCurrency(kpis.cpc),
      detail: "Custo por clique",
      className: "xl:col-span-3",
    },
    {
      label: "ROI",
      value: `${(kpis.roi * 100).toFixed(0)}%`,
      detail: "Retorno sobre investimento",
      className: "xl:col-span-3",
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
      {cards.map((card) => (
        <Kpi
          key={card.label}
          label={card.label}
          value={card.value}
          detail={card.detail}
          className={cn("sm:col-span-1", card.className)}
        />
      ))}
    </div>
  );
}
