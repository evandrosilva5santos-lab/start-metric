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
    default:
      "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]",
    cyan:
      "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]",
    secondary:
      "bg-slate-800 text-slate-300 border border-slate-700/60",
    success:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]",
    active:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]",
    roi:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]",
    warning:
      "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    destructive:
      "bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]",
    outline:
      "text-slate-300 border border-slate-700 bg-transparent",
  };

  const dotColors: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-cyan-400",
    cyan: "bg-cyan-400",
    secondary: "bg-slate-400",
    success: "bg-emerald-400",
    active: "bg-emerald-400",
    roi: "bg-emerald-400",
    warning: "bg-amber-400",
    destructive: "bg-red-400",
    outline: "bg-slate-400",
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
