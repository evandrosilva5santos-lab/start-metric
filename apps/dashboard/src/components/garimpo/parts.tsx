"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2, Search, X } from "lucide-react";
import { setOfferStatus } from "@/app/(dashboard)/garimpo/actions";
import { SOURCE_LABELS } from "@/lib/garimpo/sources/types";
import type { OfferStatus, RunView } from "@/lib/garimpo/view-types";
import { fmtCount, fmtDateTime, fmtDuration } from "./format";

export const STATUS_LABELS: Record<OfferStatus, string> = {
  novo: "Novos",
  em_analise: "Em análise",
  aprovado: "Aprovados",
  descartado: "Descartados",
};

const STALE_RUN_MS = 10 * 60_000;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("input, button, select")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-background/85" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-lg border border-border bg-popover p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 104;
  const h = 32;
  if (values.length === 0) {
    return <span className="text-xs text-text-muted" aria-label={`${label}: sem dados`}>—</span>;
  }
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values.map((v, i) => [values.length > 1 ? i * step : w / 2, h - 2 - (v / max) * (h - 4)] as const);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: ${values.join(", ")}`} className="shrink-0">
      <line x1={0} x2={w} y1={h - 1} y2={h - 1} stroke="#1c1f1e" />
      {points.length > 1 && (
        <polyline points={points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#44d5a4" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      )}
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.5} fill="#44d5a4" />
    </svg>
  );
}

function useNow(initial: number, active: boolean) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function nextStep(run: RunView): string {
  switch (run.status) {
    case "blocked":
      return "Próximo passo: espere cerca de 1 hora antes de varrer de novo, ou troque a fonte.";
    case "not_configured":
      return "Próximo passo: configure a fonte ou escolha outra.";
    case "unavailable":
      return "Próximo passo: o scraper próprio roda no cron diário, num servidor com navegador.";
    default:
      return "Próximo passo: rode a varredura de novo. Se repetir, troque a fonte.";
  }
}

const PROBLEM_TITLES: Partial<Record<RunView["status"], string>> = {
  blocked: "A Meta bloqueou a varredura",
  error: "A varredura falhou",
  not_configured: "Fonte não configurada",
  unavailable: "Scraper indisponível",
};

export function ScanStatusStrip({
  latestRun,
  lastGoodRun,
  generatedAt,
  pendingSince,
}: {
  latestRun: RunView | null;
  lastGoodRun: RunView | null;
  generatedAt: string;
  pendingSince: number | null;
}) {
  const running = latestRun?.status === "running";
  const now = useNow(Date.parse(generatedAt), pendingSince !== null || running);

  if (pendingSince !== null) {
    return (
      <div role="status" className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-primary/25 bg-primary-dim px-4 py-2.5 text-sm text-primary">
        <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span className="font-semibold">Varrendo a Biblioteca de Anúncios…</span>
        <span className="tabular-nums">{fmtDuration(new Date(pendingSince).toISOString(), null, now)}</span>
      </div>
    );
  }

  if (!latestRun) {
    return (
      <div role="status" className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-text-secondary">
        <Search size={16} aria-hidden="true" className="text-text-muted" />
        Nenhuma varredura ainda. Escolha um nicho e um país e clique em Varrer.
      </div>
    );
  }

  const stale = running && now - Date.parse(latestRun.startedAt) > STALE_RUN_MS;
  const problem = stale ? "error" : latestRun.status;
  const problemTitle = stale ? "A varredura caiu sem terminar" : PROBLEM_TITLES[problem];

  return (
    <div className="space-y-2">
      <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
        <StripItem label="Fonte" value={SOURCE_LABELS[latestRun.source]} />
        <StripItem label="Nicho" value={[latestRun.niche, latestRun.country].filter(Boolean).join(" · ") || "—"} />
        <StripItem label="Início" value={fmtDateTime(latestRun.startedAt)} />
        <StripItem label={running && !stale ? "Rodando há" : "Duração"} value={stale ? "—" : fmtDuration(latestRun.startedAt, latestRun.finishedAt, now)} />
        <StripItem label="Anúncios lidos" value={fmtCount(latestRun.adsRead)} />
        <StripItem label="Domínios" value={fmtCount(latestRun.domainsFound)} />
        {latestRun.source === "terceiro" && (
          <StripItem
            label="Custo/mil"
            value={latestRun.costPerThousand !== null ? `US$ ${latestRun.costPerThousand.toFixed(2).replace(".", ",")}` : "—"}
          />
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {problemTitle ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/25 bg-warning-dim px-2 py-0.5 text-xs font-semibold text-warning">
              <AlertTriangle size={12} aria-hidden="true" /> {latestRun.status === "blocked" ? "Bloqueada" : "Com problema"}
            </span>
          ) : running ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-dim px-2 py-0.5 text-xs font-semibold text-primary">
              <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Rodando
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary-dim px-2 py-0.5 text-xs font-semibold text-primary">
              <Check size={12} aria-hidden="true" /> Concluída
            </span>
          )}
        </div>
      </dl>

      {problemTitle && (
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning-dim px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle size={16} aria-hidden="true" />
            {problemTitle} · {fmtDateTime(latestRun.finishedAt ?? latestRun.startedAt)}
          </p>
          {latestRun.errorText && !stale && <p className="mt-1 text-text-primary">{latestRun.errorText}</p>}
          <p className="mt-1 text-text-secondary">{nextStep(stale ? { ...latestRun, status: "error" } : latestRun)}</p>
          <p className="mt-2 text-text-secondary">
            {lastGoodRun
              ? `A lista abaixo é o último resultado bom, de ${fmtDateTime(lastGoodRun.finishedAt ?? lastGoodRun.startedAt)} (${SOURCE_LABELS[lastGoodRun.source]}).`
              : "Ainda não há um resultado bom salvo para mostrar."}
          </p>
        </div>
      )}
      {!problemTitle && latestRun.errorText && <p className="px-1 text-xs text-text-muted">{latestRun.errorText}</p>}
    </div>
  );
}

function StripItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export function OfferActions({
  offerId,
  domain,
  status,
  divergent,
}: {
  offerId: string;
  domain: string;
  status: OfferStatus;
  divergent: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const submit = (next: OfferStatus, confirmDivergent = false) => {
    setMessage(null);
    startTransition(async () => {
      const result = await setOfferStatus({ offerId, status: next, confirmDivergent });
      if (result.ok) {
        setConfirmOpen(false);
        if (result.message) setMessage({ tone: "ok", text: result.message });
      } else if (result.needsConfirm) {
        setConfirmOpen(true);
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  };

  const approve = () => (divergent ? setConfirmOpen(true) : submit("aprovado"));

  const base =
    "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "aprovado" && (
          <button type="button" disabled={pending} onClick={approve} className={`${base} bg-primary text-primary-foreground hover:bg-primary-bright`}>
            <Check size={16} aria-hidden="true" /> Aprovar
          </button>
        )}
        {status === "novo" && (
          <button type="button" disabled={pending} onClick={() => submit("em_analise")} className={`${base} border border-border bg-surface-2 text-text-primary hover:bg-input`}>
            Em análise
          </button>
        )}
        {status !== "descartado" && (
          <button type="button" disabled={pending} onClick={() => submit("descartado")} className={`${base} border border-danger/30 bg-danger-dim text-danger hover:bg-danger/20`}>
            <X size={16} aria-hidden="true" /> Descartar
          </button>
        )}
        {status === "descartado" && (
          <button type="button" disabled={pending} onClick={() => submit("novo")} className={`${base} border border-border bg-surface-2 text-text-primary hover:bg-input`}>
            Voltar para Novos
          </button>
        )}
        {pending && <Loader2 size={16} className="self-center animate-spin text-text-muted motion-reduce:animate-none" aria-label="Salvando" />}
      </div>
      {message && (
        <p role="status" className={`text-xs ${message.tone === "ok" ? "text-primary" : "text-danger"}`}>
          {message.text}
        </p>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Aprovar domínio divergente?"
        description={`O domínio exibido nos anúncios não é onde o link termina (${domain}). Pode ser cloaking ou um intermediário.`}
      >
        <p className="text-sm text-text-secondary">
          Confira a cadeia de redirecionamento antes. Aprovar liga a revisita diária do scraper próprio.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirmOpen(false)} className={`${base} border border-border bg-surface-2 text-text-primary hover:bg-input`}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("aprovado", true)}
            className={`${base} border border-warning/40 bg-warning-dim text-warning hover:bg-warning/20`}
          >
            <AlertTriangle size={16} aria-hidden="true" /> Aprovar mesmo assim
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** Miniatura externa da Meta; some sem quebrar o layout se a CDN expirar o link. */
export function Thumb({ src, className = "" }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`bg-surface-2 ${className}`} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- miniatura externa da Meta
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`object-cover ${className}`} />
  );
}
