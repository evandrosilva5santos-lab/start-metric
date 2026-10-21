import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  quota?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, eyebrow, quota, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {quota && <Badge variant="neu" dot={false} className="font-mono">{quota}</Badge>}
        </div>
        {description && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {(actions || children) && <div className="flex flex-wrap items-center gap-2">{actions ?? children}</div>}
    </header>
  );
}
