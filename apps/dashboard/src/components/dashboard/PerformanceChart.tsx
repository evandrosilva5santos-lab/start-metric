"use client";

import { TrendingUp } from "lucide-react";
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
  return (
    <section className="glass rounded-3xl p-6 lg:p-7 h-[380px] lg:h-[410px] relative overflow-hidden group border-white/10">
      <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:opacity-20 transition-opacity">
        <TrendingUp size={48} className="text-cyan-400" />
      </div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-black text-white mb-1 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1 h-4 bg-cyan-500 rounded-full" />
            Curva de Performance
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            // Monitoramento de performance em tempo real
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <span className="px-2.5 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            Spend
          </span>
          <span className="px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            Revenue
          </span>
        </div>
      </div>

      <div className="h-[270px] lg:h-[285px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
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
                  return (
                    <div className="glass p-4 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
                        Data: {formatDateLabel(label)}
                      </p>
                      <div className="space-y-2">
                        {payload.map((entry: any) => (
                          <div
                            key={entry.name}
                            className="flex items-center justify-between gap-8"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                {entry.name}
                              </span>
                            </div>
                            <span className="text-xs font-black text-white text-mono">
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
              stroke="#22d3ee"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorSpend)"
              name="Gasto"
              animationDuration={1500}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#34d399"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Receita"
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
