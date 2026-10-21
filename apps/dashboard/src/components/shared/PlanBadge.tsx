import { Clock, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PlanBadgeVariant = "pro" | "soon" | "scale" | "custom";

const CONFIG = {
  pro: { label: "Recurso Pro", tone: "ag" as const, Icon: Sparkles },
  soon: { label: "Em breve", tone: "warn" as const, Icon: Clock },
  scale: { label: "Plano Scale", tone: "cli" as const, Icon: Lock },
  custom: { label: "", tone: "neu" as const, Icon: Sparkles },
};

export function PlanBadge({ variant = "pro", label, className }: { variant?: PlanBadgeVariant; label?: string; className?: string }) {
  const config = CONFIG[variant];
  return <Badge variant={config.tone} dot={false} className={cn("gap-1", className)}><config.Icon className="size-3" aria-hidden="true" />{label ?? config.label}</Badge>;
}
