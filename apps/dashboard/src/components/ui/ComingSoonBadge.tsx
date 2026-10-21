"use client";

import { Clock, Compass, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface ComingSoonBadgeProps {
  variant?: "roadmap" | "soon" | "new" | "pro" | "beta";
  label?: string;
  className?: string;
}

const CONFIG = {
  roadmap: { label: "Futura atualização", tone: "ag" as const, Icon: Compass },
  soon: { label: "Em breve", tone: "neu" as const, Icon: Clock },
  new: { label: "Novo", tone: "ok" as const, Icon: Zap },
  pro: { label: "Configuração Pro", tone: "warn" as const, Icon: Sparkles },
  beta: { label: "Beta", tone: "cli" as const, Icon: Sparkles },
};

export function ComingSoonBadge({ variant = "soon", label, className }: ComingSoonBadgeProps) {
  const { label: defaultLabel, tone, Icon } = CONFIG[variant];
  return (
    <Badge variant={tone} dot={false} className={cn("gap-1", className)}>
      <Icon className="size-3" aria-hidden="true" />
      {label ?? defaultLabel}
    </Badge>
  );
}
