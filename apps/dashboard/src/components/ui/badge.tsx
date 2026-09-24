import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "success"
    | "active"
    | "roi"
    | "warning"
    | "destructive"
    | "outline"
    | "cyan";
  pulseDot?: boolean;
  pulse?: boolean;
}

function Badge({
  className,
  variant = "default",
  pulseDot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors select-none";

  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-primary-dim text-primary border border-primary/25",
    cyan: "bg-surface-2 text-series-2 border border-series-2/25",
    secondary: "bg-surface-2 text-text-secondary border border-border",
    success: "bg-primary-dim text-primary border border-primary/25",
    active: "bg-primary-dim text-primary border border-primary/25",
    roi: "bg-primary-dim text-primary border border-primary/25",
    warning: "bg-warning-dim text-warning border border-warning/25",
    destructive: "bg-danger-dim text-danger border border-danger/25",
    outline: "text-text-secondary border border-border bg-transparent",
  };

  const dotColors: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-primary",
    cyan: "bg-series-2",
    secondary: "bg-text-muted",
    success: "bg-primary",
    active: "bg-primary",
    roi: "bg-primary",
    warning: "bg-warning",
    destructive: "bg-danger",
    outline: "bg-text-muted",
  };

  const shouldPulse = pulseDot || pulse;

  return (
    <div
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    >
      {shouldPulse && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              dotColors[variant],
            )}
          />
          <span
            className={cn(
              "relative inline-flex rounded-full h-1.5 w-1.5",
              dotColors[variant],
            )}
          />
        </span>
      )}
      {children}
    </div>
  );
}

export { Badge };
