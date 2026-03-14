"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
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
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay,
        ease: [0.23, 1, 0.32, 1] 
      }}
      onMouseMove={handleMouseMove}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group cursor-default noise-overlay"
    >
      {/* Glow de fundo dinâmico */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl"
        style={{
          background: useMotionTemplate`radial-gradient(400px circle at ${mouseX}px ${mouseY}px, ${color}20, transparent 80%)`,
        }}
      />

      {/* Grid tático interno (sutil) */}
      <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-500 bg-grid pointer-events-none" />

      {/* Scanline Effect */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-2xl">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-scanline opacity-0 group-hover:opacity-100" />
      </div>

      {/* Borda HUD lateral */}
      <div 
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-8 rounded-r-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_10px_currentColor]"
        style={{ backgroundColor: color, color }}
      />

      {/* Header: ícone + trend */}
      <div className="flex items-center justify-between relative z-10">
        <div
          className="p-3 rounded-2xl flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-500 border border-white/5"
          style={{ 
            backgroundColor: `${color}10`, 
            color,
            boxShadow: `0 0 20px ${color}15` 
          }}
        >
          <Icon size={22} className="stroke-[2.5px]" />
        </div>

        {trend && (
          <div
            className={`flex items-center gap-1.5 text-[10px] uppercase font-black px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-300 group-hover:shadow-[0_0_15px_-5px_currentColor] ${
              trend.isPositive
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
            style={{ color: trend.isPositive ? "#34d399" : "#f87171" }}
          >
            {trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </div>
        )}
      </div>

      {/* Valor + título */}
      <div className="relative z-10 mt-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-2 flex items-center gap-2 group-hover:text-slate-400 transition-colors">
          <span className="w-2 h-[1px] bg-slate-800 group-hover:w-4 group-hover:bg-cyan-500/50 transition-all duration-500" />
          {title}
        </p>
        <div className="flex items-baseline gap-1">
          <p className="text-3xl font-black text-white text-mono leading-none tracking-tighter drop-shadow-md group-hover:scale-[1.02] transition-transform duration-500">
            {value}
          </p>
        </div>
        {trend?.label && (
          <p className="text-[10px] text-slate-600 mt-2.5 font-bold tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
            // {trend.label}
          </p>
        )}
      </div>

      {/* Border Light effect */}
      <div className="absolute inset-0 border border-white/5 rounded-2xl pointer-events-none group-hover:border-white/10 transition-colors duration-500" />
    </motion.div>
  );
}
