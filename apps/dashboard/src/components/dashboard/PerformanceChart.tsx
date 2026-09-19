"use client";

import { TrendingUp, BarChart2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardChartPoint } from "@/lib/dashboard/types";
import { useMounted } from "@/hooks/useMounted";
import { EmptyState } from "@/components/ui/EmptyState";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateLabel(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type PerformanceChartProps = {
  data: DashboardChartPoint[];
};

export function PerformanceChart({ data }: PerformanceChartProps) {
  const isMounted = useMounted();
  const hasData = Boolean(data && data.length > 0);

  return (
    <section className="glass glass-2 rounded-3xl p-6 lg:p-7 h-[380px] lg:h-[410px] relative overflow-hidden group border-white/10 noise-overlay flex flex-col justify-between">
      <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        <TrendingUp size={48} className="text-cyan-400" />
      </div>
      <div className="absolute -bottom-20 -left-10 w-52 h-52 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />

      <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
        <div>
          <h2 className="text-base font-black text-white mb-1 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-4 bg-cyan-500 rounded-full" />
            Curva de Performance
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {"// Investimento x Retorno por Período"}
          </p>
        </div>
        {hasData && (
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="px-2.5 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              Gasto
            </span>
            <span className="px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
              Receita
            </span>
          </div>
        )}
      </div>

      <div className="h-[270px] lg:h-[285px] w-full relative z-10">
        {!isMounted ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="h-full w-full rounded-2xl bg-white/[0.02] animate-pulse border border-white/5" />
          </div>
        ) : !hasData ? (
          <div className="h-full w-full flex items-center justify-center">
            <EmptyState
              icon={BarChart2}
              title="Sem telemetria gráfica"
              description="Nenhuma movimentação de spend ou receita registrada no intervalo de datas selecionado."
              className="py-6 border-transparent bg-transparent shadow-none"
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
                opacity={0.45}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                tickFormatter={formatDateLabel}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }}
                tickFormatter={(value) =>
                  `R$ ${value >= 1000 ? Math.round(value / 1000) + "k" : value}`
                }
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: "#334155", strokeWidth: 2 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const formattedLabel =
                      typeof label === "string" && label.length > 0
                        ? formatDateLabel(label)
                        : "--";

                    return (
                      <div className="glass glass-solid p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
                          Data: {formattedLabel}
                        </p>
                        <div className="space-y-2">
                          {payload.map((entry) => (
                            <div
                              key={String(entry.name)}
                              className="flex items-center justify-between gap-8"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]"
                                  style={{ backgroundColor: entry.color, color: entry.color }}
                                />
                                <span className="text-[10px] font-bold text-slate-300 uppercase">
                                  {entry.name}
                                </span>
                              </div>
                              <span className="text-xs font-black text-white text-mono">
                                {formatCurrency(Number(entry.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="spend"
                stroke="#22d3ee"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorSpend)"
                name="Gasto"
                animationDuration={1200}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#34d399"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Receita"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
