"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon, Search } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  };
  className?: string;
};

export function EmptyState({ icon: Icon = Search, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center glass rounded-[2.5rem] border-white/5 noise-overlay relative overflow-hidden group",
        className,
      )}
      role="status"
      aria-label={title}
    >
      {/* Background elements for premium feel */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2 transition-transform duration-1000 group-hover:scale-150" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 blur-[60px] rounded-full translate-y-1/2 -translate-x-1/2 transition-transform duration-1000 group-hover:scale-150" />
      
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-slate-500/10 blur-xl rounded-full scale-150 animate-pulse-slow" />
        <div className="relative glass w-20 h-20 rounded-3xl flex items-center justify-center border-white/10 shadow-2xl transition-transform duration-500 group-hover:rotate-12">
          <Icon size={32} className="text-slate-500/50" aria-hidden="true" />
        </div>
      </div>
      
      <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 relative z-10">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-slate-400 max-w-[280px] font-medium leading-relaxed relative z-10 mb-6">
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "relative z-10 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300",
            action.variant === "primary"
              ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105"
              : "bg-white/10 text-slate-300 border border-white/10 hover:bg-white/20 hover:text-white"
          )}
        >
          {action.label}
        </button>
      )}

      <div className="mt-8 relative z-10">
        <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500/50 mt-4 leading-none">
          Telemetria Off-line
        </p>
      </div>
    </div>
  );
}
