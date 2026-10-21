import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle, Link2 } from "lucide-react";
import { getDashboardContext, getDashboardData, type DashboardContext } from "@/lib/dashboard/queries";
import { getDashboardActions } from "@/lib/dashboard/actions";
import type { ActionTotals } from "@/lib/dashboard/funnel";
import type { DashboardData, DashboardFilters } from "@/lib/dashboard/types";
import { buildOverviewModel } from "@/lib/dashboard/overview";
import { RANGE_PRESETS, isIsoDate, previousRange, shortDate, todayInTimezone } from "@/lib/dashboard/overview-range";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { OverviewStamp } from "@/components/dashboard/OverviewStamp";
import { MetaSkeleton } from "@/components/meta/MetaUi";

export const metadata: Metadata = {
  title: "Visão geral | Start Metric",
  description: "Painel principal com ROAS, CPA e lucro real por campanha.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTERNAL_ACCOUNT_ID = /^(act_)?\d{1,32}$/;
const NOTICE_TIMEZONE = "America/Sao_Paulo";

function getParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return typeof value === "string" ? value : undefined;
}

function parseFilters(searchParams: SearchParams): DashboardFilters {
  const from = getParam(searchParams, "from");
  const to = getParam(searchParams, "to");
  const adAccountId = getParam(searchParams, "adAccountId");
  const clientId = getParam(searchParams, "client");
  const account = getParam(searchParams, "account");
  const range = getParam(searchParams, "range");
  const validRange = isIsoDate(from) && isIsoDate(to) && from <= to;
  const rangePreset = RANGE_PRESETS.some((preset) => preset.value === range) ? range : undefined;
  return {
    from: validRange && !rangePreset ? from : undefined,
    to: validRange && !rangePreset ? to : undefined,
    rangePreset,
    clientId: clientId && UUID.test(clientId) ? clientId : undefined,
    accountExternalId: account && EXTERNAL_ACCOUNT_ID.test(account) ? account : undefined,
    adAccountId: adAccountId && UUID.test(adAccountId) ? adAccountId : undefined,
  };
}

function noticeTime(): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: NOTICE_TIMEZONE }).format(
    new Date(),
  );
}

const primaryLink =
  "inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-bright lg:h-9";
const secondaryLink =
  "inline-flex h-11 items-center rounded-lg border border-border bg-input px-4 text-sm font-semibold text-text-primary hover:border-white-hairline-strong lg:h-9";

function Notice({
  tone,
  title,
  description,
  children,
}: {
  tone: "warning" | "neutral";
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const Icon = tone === "warning" ? AlertTriangle : Link2;
  return (
    <div
      role={tone === "warning" ? "alert" : "status"}
      className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 md:p-5"
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
          tone === "warning" ? "border-warning/30 bg-warning-dim text-warning" : "border-primary/30 bg-primary-dim text-primary"
        }`}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{description}</p>
        {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}

type Loaded = {
  context: DashboardContext;
  data: DashboardData;
  previous: DashboardData | null;
  actions: ActionTotals | null;
  previousActions: ActionTotals | null;
};

async function loadOverview(filters: DashboardFilters): Promise<Loaded> {
  const context = await getDashboardContext(filters);
  const prev = previousRange(context.range);
  const previousFilters = { ...filters, rangePreset: undefined, from: prev.from, to: prev.to };
  const [data, previous, actions, previousActions] = await Promise.all([
    getDashboardData(filters),
    getDashboardData(previousFilters).catch(() => null),
    getDashboardActions(filters).catch(() => null),
    getDashboardActions(previousFilters).catch(() => null),
  ]);
  return { context, data, previous, actions, previousActions };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "UNKNOWN_ERROR";
}

async function OverviewSection({ filters }: { filters: DashboardFilters }) {
  let loaded: Loaded | null = null;
  let failure = "";
  try {
    loaded = await loadOverview(filters);
  } catch (error) {
    failure = errorMessage(error);
  }

  if (failure === "UNAUTHORIZED") redirect("/auth");

  if (failure === "ORG_NOT_FOUND") {
    return (
      <Notice
        tone="warning"
        title="Sua conta ainda não está ligada a uma organização"
        description={`Verificado às ${noticeTime()}. Sem organização não há contas de anúncio para somar.`}
      >
        <Link href="/settings" className={primaryLink}>
          Abrir Configurações
        </Link>
      </Notice>
    );
  }

  if (!loaded) {
    return (
      <Notice
        tone="warning"
        title="Não deu para carregar os números"
        description={`Falha às ${noticeTime()} (horário de Brasília) ao ler o banco: ${failure}. Tente de novo em instantes; se continuar, confira a integração.`}
      >
        <Link href="/" className={primaryLink}>
          Tentar de novo
        </Link>
        <Link href="/settings/meta" className={secondaryLink}>
          Integrações → Meta Ads
        </Link>
      </Notice>
    );
  }

  const { context, data, previous, actions, previousActions } = loaded;

  if (context.accounts.length === 0) {
    return (
      <Notice
        tone="neutral"
        title="Nenhuma conta de anúncio ligada"
        description="Conecte a Meta da sua organização e depois, dentro de cada cliente, use “Buscar contas de anúncio”."
      >
        <Link href="/clients" className={primaryLink}>
          Ir para Clientes
        </Link>
        <Link href="/settings/meta" className={secondaryLink}>
          Conectar Meta Ads
        </Link>
      </Notice>
    );
  }

  const today = todayInTimezone(data.timezone);
  const model = buildOverviewModel(data, previous, today, { current: actions, previous: previousActions });

  return (
    <div className="space-y-6">
      <OverviewStamp generatedAt={data.generatedAt} />
      <div className="space-y-2">
        <p className="text-xs tabular-nums text-text-secondary">
          De {shortDate(model.range.from)} a {shortDate(model.range.to)}
          {model.previousRange && (
            <>
              {" "}
              · comparado com {shortDate(model.previousRange.from)} a {shortDate(model.previousRange.to)}
            </>
          )}
        </p>
      </div>

      {!model.hasData && (
        <Notice
          tone="warning"
          title="Sem métricas no banco para este período"
          description={`Conferido às ${noticeTime()} (horário de Brasília). Os números aparecem depois que a sincronização com a Meta grava os dias do período.`}
        >
          <Link href="/settings/meta" className={primaryLink}>
            Sincronizar em Integrações
          </Link>
        </Notice>
      )}

      <DashboardClient model={model} />
    </div>
  );
}

function OverviewFallback() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <MetaSkeleton />
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Visão geral</h1>
        <p className="mt-1 truncate text-sm text-text-secondary">Como a conta está indo no período</p>
      </div>
      <Suspense fallback={<OverviewFallback />}>
        <OverviewSection filters={filters} />
      </Suspense>
    </div>
  );
}
