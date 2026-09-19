import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "roi"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "glow";
  size?: "default" | "sm" | "lg" | "icon";
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default:
        "bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)] active:scale-[0.98]",
      roi:
        "bg-emerald-400 text-slate-950 hover:bg-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.25)] active:scale-[0.98]",
      secondary:
        "bg-slate-800/80 text-slate-200 border border-slate-700/60 hover:bg-slate-700/80 hover:text-white active:scale-[0.98]",
      outline:
        "border border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white active:scale-[0.98]",
      ghost:
        "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 active:scale-[0.98]",
      destructive:
        "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 active:scale-[0.98]",
      glow:
        "bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 font-bold shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] active:scale-[0.98]",
    };

    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-xs rounded-lg",
      lg: "h-12 px-6 text-base rounded-2xl",
      icon: "h-9 w-9 p-0 rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading ? "true" : undefined}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-current" />
            <span>Carregando...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
