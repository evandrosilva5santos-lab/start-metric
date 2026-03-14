"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 px-8 text-center",
        className,
      )}
      role="status"
      aria-label={title}
    >
      {Icon && (
        <div className="mb-4 p-4 rounded-2xl bg-slate-800/50 text-slate-600">
          <Icon size={32} aria-hidden="true" />
        </div>
      )}
      <p className="text-xs font-black uppercase tracking-widest text-slate-600">
        {title}
      </p>
      {description && (
        <p className="mt-2 text-[10px] font-medium text-slate-700 max-w-xs">
          {description}
        </p>
      )}
    </div>
  );
}
