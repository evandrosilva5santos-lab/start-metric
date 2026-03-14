"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon, Search } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({ icon: Icon = Search, title, description, className }: EmptyStateProps) {
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
        <p className="text-sm text-slate-400 max-w-[280px] font-medium leading-relaxed relative z-10">
          {description}
        </p>
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
