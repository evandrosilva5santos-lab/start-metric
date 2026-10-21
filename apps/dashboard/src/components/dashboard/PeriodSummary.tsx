"use client";

import { TrendingUp, MousePointerClick, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/lib/dashboard/types";
import { useMounted } from "@/hooks/useMounted";

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

type PeriodSummaryProps = {
  kpis: DashboardKpis;
  generatedAt: string;
};

export function PeriodSummary({ kpis, generatedAt }: PeriodSummaryProps) {
  const isMounted = useMounted();

  const items = [
    { label: "Impressões", value: formatNumber(kpis.impressions), icon: Eye },
    { label: "Cliques", value: formatNumber(kpis.clicks), icon: MousePointerClick },
    { label: "Conversões", value: formatNumber(kpis.attributedConversions), icon: TrendingUp },
    {
      label: "ROI",
      value: `${(kpis.roi * 100).toFixed(2)}%`,
      icon: TrendingUp,
      highlight: true,
    },
  ];

  const formattedTime = isMounted && generatedAt
    ? new Date(generatedAt).toLocaleTimeString("pt-BR")
    : "--:--:--";

  return (
    <section className="glass glass-2 rounded-3xl p-6 lg:p-7 h-[380px] lg:h-[410px] flex flex-col relative overflow-hidden border-border noise-overlay justify-between">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-tint blur-3xl pointer-events-none" />

      <div>
        <h2 className="text-base font-black text-fg mb-1 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-4 bg-success rounded-full" />
          Resumo de Período
        </h2>
        <p className="text-[12px] font-bold text-fg-muted mb-6 uppercase tracking-widest">
          {"// Agregado Tático Global"}
        </p>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="group/item relative">
              <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-subtle transition-all duration-300 border border-transparent hover:border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-subtle text-fg-muted group-hover/item:text-primary transition-colors border border-border">
                    <item.icon size={14} />
                  </div>
                  <span className="text-[12px] font-black uppercase text-fg-muted tracking-widest group-hover/item:text-fg transition-colors">
                    {item.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm font-black text-mono group-hover/item:scale-105 transition-transform",
                    item.highlight
                      ? "text-success animate-glow-pulse"
                      : "text-fg",
                  )}
                >
                  {item.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-border flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-success rounded-full animate-ping" />
          <span className="text-[12px] font-bold text-fg-muted uppercase tracking-widest">
            Telemetria Ativa
          </span>
        </div>
        <span
          className="text-[12px] font-black text-fg-muted uppercase tracking-widest font-mono"
          suppressHydrationWarning
        >
          Atualizado: {formattedTime}
        </span>
      </div>
    </section>
  );
}
