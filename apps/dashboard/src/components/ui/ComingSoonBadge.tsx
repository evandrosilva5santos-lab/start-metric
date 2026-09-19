"use client";

import React from "react";
import { Sparkles, Clock, Compass, Zap } from "lucide-react";

export interface ComingSoonBadgeProps {
  variant?: "roadmap" | "soon" | "new" | "pro" | "beta";
  label?: string;
  className?: string;
}

export function ComingSoonBadge({
  variant = "soon",
  label,
  className = "",
}: ComingSoonBadgeProps) {
  switch (variant) {
    case "new":
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)] ${className}`}
        >
          <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
          {label || "Novo"}
        </span>
      );

    case "pro":
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-300 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)] ${className}`}
        >
          <Sparkles className="w-3 h-3 text-amber-300" />
          {label || "Configuração Pro"}
        </span>
      );

    case "roadmap":
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)] ${className}`}
        >
          <Compass className="w-3 h-3 text-cyan-300" />
          {label || "Futura Atualização"}
        </span>
      );

    case "beta":
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 ${className}`}
        >
          <Sparkles className="w-3 h-3 text-purple-300" />
          {label || "Beta"}
        </span>
      );

    case "soon":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700/60 uppercase tracking-wider ${className}`}
        >
          <Clock className="w-2.5 h-2.5 text-slate-400" />
          {label || "Em breve"}
        </span>
      );
  }
}
