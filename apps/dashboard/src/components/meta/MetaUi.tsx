"use client";

import Link from "next/link";
import { AlertTriangle, Link2 } from "lucide-react";
import { formatVariation } from "@/lib/format";
import { useMetaAccounts, useMetaDados } from "@/hooks/useMetaDashboard";
import type { DadosResponse } from "@/lib/meta/dados-types";

export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data } = useMetaDados();
  return (
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
      <p className="mt-1 truncate text-sm text-text-secondary">
        {subtitle}
        {data?.conta?.name && (
          <>
            {subtitle ? " · " : ""}
            <span className="text-text-muted" title={data.conta.name}>
              {data.conta.name}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/** "good" = subir é bom, "bad" = subir é ruim, "neutral" = só informa (ex.: gasto). */
export type VariationSense = "good" | "bad" | "neutral";

export function VariationBadge({ value, sense }: { value: number | undefined; sense: VariationSense }) {
  if (value === undefined || !Number.isFinite(value)) return null;
  let tone = "border-border bg-surface-2 text-text-secondary";
  if (sense !== "neutral" && value !== 0) {
    const improved = sense === "good" ? value > 0 : value < 0;
    tone = improved
      ? "border-primary/25 bg-primary-dim text-primary"
      : "border-danger/25 bg-danger-dim text-danger";
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
      title="Comparado ao período anterior"
    >
      {formatVariation(value)}
    </span>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  variation,
  sense = "neutral",
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  variation?: number;
  sense?: VariationSense;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
        <VariationBadge value={variation} sense={sense} />
      </div>
      <div
        className={`mt-2 truncate font-display font-bold tracking-tight tabular-nums ${
          emphasis ? "text-2xl text-primary md:text-3xl" : "text-2xl text-foreground md:text-3xl"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 truncate text-xs text-text-muted">{hint}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-border bg-card p-4 md:p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none ${className}`} />;
}

export function MetaSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando dados da Meta">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[116px]" />
        ))}
      </div>
      <SkeletonBlock className="h-72" />
    </div>
  );
}

/**
 * Cuida dos estados antes de haver dados (sem conta, carregando, erro) e só
 * chama `children` quando a resposta da Meta está disponível.
 */
export function MetaDataGate({ children }: { children: (data: DadosResponse) => React.ReactNode }) {
  const accounts = useMetaAccounts();
  const dados = useMetaDados();

  if (accounts.isError) {
    return <ErrorPanel message={accounts.error.message} onRetry={() => void accounts.refetch()} />;
  }

  if (accounts.isSuccess && accounts.accounts.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center">
        <Link2 className="mx-auto text-primary" size={28} />
        <h2 className="mt-3 font-display text-lg font-semibold text-foreground">Nenhuma conta de anúncio ligada</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Conecte a Meta da sua organização e depois, dentro de cada cliente, use “Buscar contas de anúncio”.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/clients"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-bright"
          >
            Ir para Clientes
          </Link>
          <Link
            href="/settings/meta"
            className="inline-flex h-11 items-center rounded-lg border border-border bg-input px-4 text-sm font-semibold text-text-primary hover:border-white-hairline-strong"
          >
            Conectar Meta Ads
          </Link>
        </div>
      </div>
    );
  }

  if (dados.data) return <>{children(dados.data)}</>;

  if (dados.isError) {
    return <ErrorPanel message={dados.error.message} onRetry={() => void dados.refetch()} />;
  }

  return <MetaSkeleton />;
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  const isTokenExpired =
    message.includes("190") ||
    message.toLowerCase().includes("access token") ||
    message.toLowerCase().includes("session has been invalidated");

  if (isTokenExpired) {
    return (
      <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-warning/30 bg-warning-dim/40 p-7 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle size={24} />
        </div>
        <h2 className="mt-4 font-display text-lg font-bold text-foreground">Conexão com a Meta Expirou</h2>
        <p className="mt-2 text-sm text-text-secondary leading-relaxed">
          A sessão do Facebook desta conta foi invalidada (por segurança, troca de senha ou expiração do token de 60 dias).
          Para voltar a acompanhar suas campanhas em tempo real, renove o acesso com 1 clique.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/settings/meta"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary-bright"
          >
            Reconectar Meta Ads
          </Link>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-input px-4 text-sm font-medium text-text-primary hover:border-white-hairline-strong transition-colors"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-danger/30 bg-danger-dim p-6 text-center">
      <AlertTriangle className="mx-auto text-danger" size={24} />
      <p className="mt-2 text-sm font-semibold text-foreground">Não deu para carregar os dados</p>
      <p className="mt-1 text-xs text-text-secondary">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-9 items-center rounded-lg border border-border bg-input px-4 text-sm font-medium text-text-primary hover:border-white-hairline-strong transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  );
}
