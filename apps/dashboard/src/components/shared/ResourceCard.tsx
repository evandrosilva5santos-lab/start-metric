import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PlanBadge, type PlanBadgeVariant } from "@/components/shared/PlanBadge";
import { StatusPill, type StatusType } from "@/components/shared/StatusPill";

export interface ResourceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  status?: StatusType;
  statusLabel?: string;
  planBadge?: { variant: PlanBadgeVariant; label?: string };
  connectedInfo?: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ResourceCard({ icon, title, description, status, statusLabel, planBadge, connectedInfo, actionLabel = "Gerenciar", onAction, disabled = false, className }: ResourceCardProps) {
  return (
    <Card className={cn("h-full transition-colors hover:border-primary/40", className)}>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">{icon}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{title}</h3>{planBadge && <PlanBadge {...planBadge} />}</div>
              {connectedInfo && <p className="mt-0.5 truncate text-xs text-muted-foreground">{connectedInfo}</p>}
            </div>
          </div>
          {status && <StatusPill status={status} label={statusLabel} />}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        {onAction && <div className="mt-auto border-t border-border pt-3 text-right"><Button size="sm" variant="outline" disabled={disabled} onClick={onAction}>{actionLabel}</Button></div>}
      </CardContent>
    </Card>
  );
}
