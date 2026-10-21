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
import { AXIS_COLOR, CHART_SERIES, GRID_COLOR } from "@/lib/chart-theme";

function formatCurrency(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
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
    <section className="glass glass-2 rounded-3xl p-6 lg:p-7 h-[380px] lg:h-[410px] relative overflow-hidden group border-border noise-overlay flex flex-col justify-between">
      <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        <TrendingUp size={48} className="text-primary" />
      </div>
      <div className="absolute -bottom-20 -left-10 w-52 h-52 rounded-full bg-primary-tint blur-[80px] pointer-events-none" />

      <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
        <div>
          <h2 className="text-base font-black text-fg mb-1 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-4 bg-primary rounded-full" />
            Curva de Performance
          </h2>
          <p className="text-[12px] font-bold text-fg-muted uppercase tracking-widest">
            {"// Investimento x Retorno por Período"}
          </p>
        </div>
        {hasData && (
          <div className="hidden sm:flex items-center gap-2 text-[12px] font-black uppercase tracking-widest">
            <span className="px-2.5 py-1 rounded-full border border-primary/20 bg-primary-tint text-primary">
              Gasto
            </span>
            <span className="px-2.5 py-1 rounded-full border border-success/20 bg-success-tint text-success">
              Receita
            </span>
          </div>
        )}
      </div>

      <div className="h-[270px] lg:h-[285px] w-full relative z-10">
        {!isMounted ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="h-full w-full rounded-2xl bg-subtle animate-pulse border border-border" />
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
                  <stop offset="5%" stopColor={CHART_SERIES[0]} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={CHART_SERIES[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_SERIES[2]} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={CHART_SERIES[2]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={GRID_COLOR}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickFormatter={formatDateLabel}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                tickFormatter={(value) =>
                  `R$ ${value >= 1000 ? Math.round(value / 1000) + "k" : value}`
                }
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const formattedLabel =
                      typeof label === "string" && label.length > 0
                        ? formatDateLabel(label)
                        : "—";

                    return (
                      <div className="rounded-button border border-border bg-popover p-3 text-popover-foreground shadow-pop">
                        <p className="mb-2 border-b border-border pb-1.5 text-[12px] text-fg-muted">
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
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: entry.color, color: entry.color }}
                                />
                                <span className="text-[12px] text-fg-muted">
                                  {entry.name}
                                </span>
                              </div>
                              <span className="text-[12px] font-medium text-fg tabular-nums">
                                {formatCurrency(entry.value)}
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
                stroke={CHART_SERIES[0]}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSpend)"
                name="Gasto"
                animationDuration={1200}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={CHART_SERIES[2]}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Receita"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-surface to-transparent" />
    </section>
  );
}
