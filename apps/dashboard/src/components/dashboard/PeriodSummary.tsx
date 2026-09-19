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
    <section className="glass glass-2 rounded-3xl p-6 lg:p-7 h-[380px] lg:h-[410px] flex flex-col relative overflow-hidden border-white/10 noise-overlay justify-between">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl pointer-events-none" />

      <div>
        <h2 className="text-base font-black text-white mb-1 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-4 bg-emerald-500 rounded-full" />
          Resumo de Período
        </h2>
        <p className="text-[10px] font-bold text-slate-500 mb-6 uppercase tracking-widest">
          {"// Agregado Tático Global"}
        </p>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="group/item relative">
              <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-800/50 text-slate-400 group-hover/item:text-cyan-400 transition-colors border border-white/5">
                    <item.icon size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest group-hover/item:text-slate-300 transition-colors">
                    {item.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm font-black text-mono group-hover/item:scale-105 transition-transform",
                    item.highlight
                      ? "text-emerald-400 animate-glow-pulse"
                      : "text-white",
                  )}
                >
                  {item.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
            Telemetria Ativa
          </span>
        </div>
        <span
          className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono"
          suppressHydrationWarning
        >
          Atualizado: {formattedTime}
        </span>
      </div>
    </section>
  );
}
