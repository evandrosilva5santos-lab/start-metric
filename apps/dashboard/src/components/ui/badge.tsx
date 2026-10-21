import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type PillTone = "ok" | "warn" | "bad" | "neu" | "off" | "cli" | "ag";
type LegacyVariant = "default" | "secondary" | "success" | "active" | "roi" | "warning" | "destructive" | "outline" | "cyan";

const badgeVariants = cva(
  "inline-flex h-[22px] w-fit shrink-0 select-none items-center justify-center gap-[5px] overflow-hidden whitespace-nowrap rounded-full border border-transparent px-2 text-xs font-medium leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      tone: {
        ok: "bg-success-tint text-success",
        warn: "bg-warning-tint text-warning",
        bad: "bg-danger-tint text-danger",
        neu: "border-border bg-muted text-muted-foreground",
        off: "border-dashed border-border-strong bg-transparent text-muted-foreground",
        cli: "bg-client-tint text-client",
        ag: "bg-agency-tint text-agency",
      },
    },
    defaultVariants: { tone: "neu" },
  },
);

const LEGACY_TONE: Record<LegacyVariant, PillTone> = {
  default: "ag",
  secondary: "neu",
  success: "ok",
  active: "ok",
  roi: "ok",
  warning: "warn",
  destructive: "bad",
  outline: "off",
  cyan: "neu",
};

const TONES_WITH_DOT = new Set<PillTone>(["ok", "warn", "bad", "neu"]);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillTone | LegacyVariant;
  dot?: boolean;
  pulseDot?: boolean;
  pulse?: boolean;
  asChild?: boolean;
}

function toTone(variant: NonNullable<BadgeProps["variant"]>): PillTone {
  return variant in LEGACY_TONE ? LEGACY_TONE[variant as LegacyVariant] : (variant as PillTone);
}

function Badge({ className, variant = "neu", dot, pulseDot = false, pulse = false, asChild = false, children, ...props }: BadgeProps) {
  const tone = toTone(variant);
  const shouldPulse = pulseDot || pulse;
  const showDot = dot ?? (TONES_WITH_DOT.has(tone) || shouldPulse);
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" data-tone={tone} className={cn(badgeVariants({ tone }), className)} {...props}>
      {showDot && (
        <span className="relative flex size-1.5 shrink-0" aria-hidden="true">
          {shouldPulse && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />}
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </Comp>
  );
}

const Pill = Badge;

export { Badge, Pill, badgeVariants };
