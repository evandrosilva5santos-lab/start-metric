import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface KpiProps {
  label: string;
  value: string | null | undefined;
  detail?: ReactNode;
  source?: ReactNode;
  badge?: ReactNode;
  emphasis?: boolean;
  estimated?: boolean;
  className?: string;
}

const EMPTY_VALUE = "—";

export function Kpi({ label, value, detail, source, badge, emphasis = false, estimated = false, className }: KpiProps) {
  const isEmpty = value === null || value === undefined || value === "" || value === EMPTY_VALUE;

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-panel border border-border bg-surface px-3.5 py-3 shadow-card",
        className,
      )}
    >
      <header className="flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[13px] leading-[1.45] text-fg-muted">{label}</p>
        {badge}
      </header>
      <p
        className={cn(
          "truncate font-body text-[24px] font-semibold leading-[1.15] tabular-nums",
          isEmpty ? "text-faint" : emphasis ? "text-primary" : "text-fg",
          estimated && !isEmpty && "underline decoration-faint decoration-dashed decoration-1 underline-offset-[6px]",
        )}
        title={estimated ? "Valor estimado" : undefined}
      >
        {isEmpty ? EMPTY_VALUE : value}
      </p>
      {detail && <p className="text-[12px] leading-[1.4] text-fg-muted tabular-nums">{detail}</p>}
      {source && (
        <p className="mt-0.5 border-t border-border pt-1.5 text-[12px] leading-[1.4] text-fg-muted">{source}</p>
      )}
    </article>
  );
}

export interface StatCardProps {
  title: string;
  value: string;
  detail?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function StatCard({ title, value, detail, badge, className }: StatCardProps) {
  return <Kpi label={title} value={value} detail={detail} badge={badge} className={className} />;
}
