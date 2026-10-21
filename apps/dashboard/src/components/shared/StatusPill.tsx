import { cn } from "@/lib/utils";

export type StatusType = "active" | "connected" | "disconnected" | "paused" | "error" | "pending";

const CONFIG: Record<StatusType, { label: string; className: string; dot: string }> = {
  active: { label: "Ativa", className: "bg-success-tint text-success", dot: "bg-success" },
  connected: { label: "Conectado", className: "bg-success-tint text-success", dot: "bg-success" },
  disconnected: { label: "Desconectado", className: "bg-danger-tint text-danger", dot: "bg-danger" },
  paused: { label: "Pausado", className: "bg-warning-tint text-warning", dot: "bg-warning" },
  error: { label: "Erro", className: "bg-danger-tint text-danger", dot: "bg-danger" },
  pending: { label: "Pendente", className: "border border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

export function StatusPill({ status, label, className }: { status: StatusType; label?: string; className?: string }) {
  const config = CONFIG[status];
  return <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium", config.className, className)}><span className={cn("size-1.5 rounded-full", config.dot)} aria-hidden="true" />{label ?? config.label}</span>;
}
