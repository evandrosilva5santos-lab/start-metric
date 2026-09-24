import { AlertOctagon, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import type { Aviso } from "@/lib/meta/dados-types";

const TONES: Record<Aviso["tipo"], { icon: LucideIcon; label: string; className: string }> = {
  alerta: { icon: AlertOctagon, label: "Alerta", className: "border-danger/30 bg-danger-dim text-danger" },
  atencao: { icon: AlertTriangle, label: "Atenção", className: "border-warning/30 bg-warning-dim text-warning" },
  sucesso: { icon: CheckCircle2, label: "Oportunidade", className: "border-primary/30 bg-primary-dim text-primary" },
  info: { icon: Info, label: "Informação", className: "border-border bg-surface-2 text-text-secondary" },
};

export function AvisoList({ avisos, compact = false }: { avisos: Aviso[]; compact?: boolean }) {
  if (avisos.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary-dim p-3">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Nada fora do normal</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            Nenhum desvio de entrega, CTR ou custo foi encontrado no período.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {avisos.map((aviso, idx) => {
        const tone = TONES[aviso.tipo] ?? TONES.info;
        const Icon = tone.icon;
        return (
          <li key={`${aviso.titulo}-${idx}`} className="rounded-lg border border-border bg-surface-2 p-3 md:p-4">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${tone.className}`}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{tone.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{aviso.titulo}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{aviso.descricao}</p>
                {!compact && aviso.acao && (
                  <p className="mt-2 text-xs leading-relaxed text-text-primary">
                    <span className="font-semibold text-primary">O que fazer: </span>
                    {aviso.acao}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
