"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  trend?: {
    value: string;
    isPositive: boolean;
    label?: string;
  };
  icon: LucideIcon;
  color: string;
  delay?: number;
}

export function StatCard({ title, value, trend, icon: Icon, color, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group cursor-default"
    >
      {/* Glow de fundo ao hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
        style={{
          background: `radial-gradient(circle at top right, ${color}14 0%, transparent 70%)`,
        }}
      />

      {/* Borda topo colorida */}
      <div
        className="absolute top-0 left-6 right-6 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }}
      />

      {/* Header: ícone + trend */}
      <div className="flex items-center justify-between">
        <div
          className="p-2.5 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <Icon size={20} />
        </div>

        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
              trend.isPositive
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {trend.isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend.value}
          </div>
        )}
      </div>

      {/* Valor + título */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em] mb-1">
          {title}
        </p>
        <p className="text-2xl font-extrabold text-white text-mono leading-none">
          {value}
        </p>
        {trend?.label && (
          <p className="text-xs text-slate-600 mt-1">{trend.label}</p>
        )}
      </div>
    </motion.div>
  );
}
