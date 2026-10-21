"use client";

import { Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EmptyStateAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "glow";
};

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryNote?: string;
  className?: string;
};

export function EmptyState({ icon: Icon = Search, title, description, action, secondaryNote, className }: EmptyStateProps) {
  return (
    <section
      className={cn("flex flex-col items-center justify-center rounded-panel border border-dashed border-border-strong bg-surface p-8 text-center md:p-12", className)}
      aria-labelledby={`empty-${title.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-subtle text-fg-muted">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 id={`empty-${title.replace(/\s+/g, "-").toLowerCase()}`} className="font-display text-[16px] font-semibold text-fg">
        {title}
      </h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && (
        <Button variant={action.variant ?? "default"} size="sm" onClick={action.onClick} className="mt-5">
          {action.label}
        </Button>
      )}
      {secondaryNote && <p className="mt-3 text-xs text-muted-foreground">{secondaryNote}</p>}
    </section>
  );
}
