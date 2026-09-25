import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionSubject } from "@/lib/auth/session";
import { filtersKey, getDashboardContext, getDashboardData } from "@/lib/dashboard/queries";
import type { DashboardFilters } from "@/lib/dashboard/types";
import { snapshotStorageKey } from "@/lib/dashboard/snapshot";
import {
  PerformanceResultsSkeleton,
  PerformanceResultsView,
} from "@/components/dashboard/PerformanceResultsView";
import {
  PerformanceSnapshotPreview,
  PerformanceSnapshotWriter,
} from "@/components/dashboard/PerformanceSnapshot";

export const metadata = {
  title: "Performance | Start Metric",
  description: "Analise campanhas Meta Ads com gasto, receita, ROAS e CPA.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  if (typeof value === "string") return value;
  return undefined;
}

function LoadError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "UNAUTHORIZED") redirect("/auth");

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-white">Não deu para carregar os números</h2>
      <p className="text-slate-400 mt-2 text-sm">Falha ao carregar dados: {message}</p>
    </div>
  );
}

// Cabeçalho e filtros: só precisam de contas, período e fuso. Chegam antes
// das métricas, então a tela já mostra o recorte enquanto os números vêm.
async function PerformanceHeader({ filters }: { filters: DashboardFilters }) {
  let data: Awaited<ReturnType<typeof getDashboardContext>>;
  try {
    data = await getDashboardContext(filters);
  } catch (error) {
    return <LoadError error={error} />;
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold">
            Meta Ads
          </p>
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
            Performance de Campanhas
          </h1>
          <p className="text-xs text-slate-500">
            {data.range.from} → {data.range.to} · TZ: {data.timezone}
          </p>
        </div>
        <Link
          href="/settings/meta"
          className="px-4 py-2.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-400/20 transition-all duration-200"
        >
          Conectar / Gerenciar Meta
        </Link>
      </div>

      {/* Filters */}
      <form
        action="/performance"
        method="get"
        className="glass rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="space-y-1">
          <label htmlFor="perfAccountSelect" className="text-xs text-slate-500">Conta</label>
          <select
            id="perfAccountSelect"
            name="adAccountId"
            aria-label="Selecionar conta de anúncios"
            defaultValue={data.filters.adAccountId}
            className="w-full glass rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="all">Todas</option>
            {data.filterOptions.accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="perfStatusSelect" className="text-xs text-slate-500">Status</label>
          <select
            id="perfStatusSelect"
            name="campaignStatus"
            aria-label="Selecionar status da campanha"
            defaultValue={data.filters.campaignStatuses.length === 0 ? "all" : data.filters.campaignStatuses[0]}
            className="w-full glass rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="all">Todos</option>
            {data.filterOptions.statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="perfFromDate" className="text-xs text-slate-500">De</label>
          <input
            id="perfFromDate"
            name="from"
            type="date"
            aria-label="Data de início"
            defaultValue={data.range.from}
            className="w-full glass rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="perfToDate" className="text-xs text-slate-500">Até</label>
          <input
            id="perfToDate"
            name="to"
            type="date"
            aria-label="Data de término"
            defaultValue={data.range.to}
            className="w-full glass rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          />
        </div>

        <div className="md:col-span-4 flex items-center justify-end gap-3">
          <Link
            href="/performance"
            className="text-sm text-slate-500 hover:text-slate-200 transition-colors"
          >
            Limpar
          </Link>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-400/20 transition-all duration-200"
          >
            Aplicar filtros
          </button>
        </div>
      </form>
    </>
  );
}

async function PerformanceResults({
  filters,
  storageKey,
}: {
  filters: DashboardFilters;
  storageKey: string | null;
}) {
  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try {
    data = await getDashboardData(filters);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // O cabeçalho já mostra o erro de sessão ou de organização.
    if (message === "UNAUTHORIZED" || message === "ORG_NOT_FOUND") return <div data-perf-live hidden />;
    return (
      <div data-perf-live>
        <LoadError error={error} />
      </div>
    );
  }

  if (data.campaigns.length === 0) {
    return (
      <div data-perf-live className="glass rounded-2xl p-8">
        <h2 className="text-lg font-semibold text-white">Sem dados ainda</h2>
        <p className="text-slate-400 mt-2 text-sm">
          Conecte uma conta Meta e clique em &quot;Sincronizar&quot; em{" "}
          <Link href="/settings/meta" className="text-cyan-400 hover:text-cyan-300">
            Integrações → Meta Ads
          </Link>
          . Depois volte aqui para ver campanhas e métricas.
        </p>
      </div>
    );
  }

  return (
    <div data-perf-live>
      <PerformanceResultsView kpis={data.kpis} campaigns={data.campaigns} generatedAt={data.generatedAt} />
      {storageKey ? (
        <PerformanceSnapshotWriter
          storageKey={storageKey}
          snapshot={{
            filtersKey: filtersKey(filters),
            generatedAt: data.generatedAt,
            range: data.range,
            kpis: data.kpis,
            campaigns: data.campaigns,
          }}
        />
      ) : null}
    </div>
  );
}

function HeaderFallback() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-3 w-20 rounded-full bg-white/5 animate-pulse" />
        <div className="h-8 w-72 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-3 w-56 rounded-full bg-white/5 animate-pulse" />
      </div>
      <div className="glass rounded-2xl h-[168px] md:h-[124px] animate-pulse" />
    </div>
  );
}

import { cookies } from "next/headers";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const cookieStore = await cookies();
  const painelCookie = cookieStore.get(PAINEL_COOKIE_NAME)?.value;
  const isPainel = await isPainelAuthorized(painelCookie);
  if (isPainel) {
    redirect("/");
  }

  const userId = await getSessionSubject();
  if (!userId) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const campaignStatusParam = getParam(resolvedParams, "campaignStatus");

  const filters: DashboardFilters = {
    from: getParam(resolvedParams, "from"),
    to: getParam(resolvedParams, "to"),
    adAccountId: getParam(resolvedParams, "adAccountId"),
    campaignStatuses: campaignStatusParam ? [campaignStatusParam] : undefined,
  };

  const storageKey = userId ? snapshotStorageKey(userId) : null;

  return (
    <div className="flex-1 min-w-0">
      <div className="max-w-6xl mx-auto space-y-8">
        <Suspense fallback={<HeaderFallback />}>
          <PerformanceHeader filters={filters} />
        </Suspense>

        <div>
          {storageKey ? (
            <PerformanceSnapshotPreview storageKey={storageKey} filtersKey={filtersKey(filters)} />
          ) : null}
          <Suspense fallback={<PerformanceResultsSkeleton />}>
            <PerformanceResults filters={filters} storageKey={storageKey} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
