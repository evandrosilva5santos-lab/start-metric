"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "glow";
  };
  className?: string;
};

export function EmptyState({
  icon: Icon = Search,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 lg:p-12 text-center glass glass-2 rounded-[2.5rem] border-white/5 noise-overlay relative overflow-hidden group",
        className
      )}
      role="status"
      aria-label={title}
    >
      {/* Background elements for premium ambient glow */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/5 blur-[70px] rounded-full -translate-y-1/2 translate-x-1/2 transition-transform duration-1000 group-hover:scale-150 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-500/5 blur-[70px] rounded-full translate-y-1/2 -translate-x-1/2 transition-transform duration-1000 group-hover:scale-150 pointer-events-none" />

      <div className="relative mb-5">
        <div className="absolute inset-0 bg-slate-500/10 blur-xl rounded-full scale-150 animate-pulse-slow pointer-events-none" />
        <div className="relative glass w-18 h-18 rounded-3xl flex items-center justify-center border-white/10 shadow-2xl transition-transform duration-500 group-hover:rotate-6">
          <Icon size={28} className="text-cyan-400/70" aria-hidden="true" />
        </div>
      </div>

      <h3 className="text-lg lg:text-xl font-black text-white uppercase tracking-tight mb-2 relative z-10">
        {title}
      </h3>

      {description && (
        <p className="text-xs lg:text-sm text-slate-400 max-w-sm font-medium leading-relaxed relative z-10 mb-6">
          {description}
        </p>
      )}

      {action && (
        <div className="relative z-10">
          <Button
            variant={action.variant ?? "default"}
            size="sm"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        </div>
      )}

      <div className="mt-8 relative z-10">
        <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500/60 mt-3 leading-none">
          Telemetria Start Metric
        </p>
      </div>
    </div>
  );
}
