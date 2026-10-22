import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AlertTriangle, Link2 } from "lucide-react";
import { getDashboardContext, getDashboardData, type DashboardContext } from "@/lib/dashboard/queries";
import { getDashboardActions } from "@/lib/dashboard/actions";
import { getClientCards, type ClientCardsModel } from "@/lib/dashboard/cards/load";
import type { ActionTotals } from "@/lib/dashboard/funnel";
import type { DashboardData, DashboardFilters } from "@/lib/dashboard/types";
import { buildOverviewModel } from "@/lib/dashboard/overview";
import {
  DEFAULT_PRESET,
  RANGE_PRESETS,
  isIsoDate,
  previousRange,
  resolvePreset,
  shortDate,
  todayInTimezone,
} from "@/lib/dashboard/overview-range";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { ChannelOverview } from "@/components/dashboard/ChannelOverview";
import { GoogleAdsDashboard } from "@/components/google/GoogleAdsDashboard";
import { OverviewStamp } from "@/components/dashboard/OverviewStamp";
import { SyncNowButton, type SyncScopeAccount } from "@/components/dashboard/SyncNowButton";
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

function syncScope(context: DashboardContext): SyncScopeAccount[] {
  const selected = context.filters.adAccountId;
  return context.accounts
    .filter((account) => selected === "all" || account.id === selected)
    .map((account) => ({
      externalId: account.external_id,
      name: account.name ?? account.external_id,
      lastSyncedAt: account.last_synced_at,
    }));
}

type Loaded = {
  context: DashboardContext;
  data: DashboardData;
  previous: DashboardData | null;
  actions: ActionTotals | null;
  previousActions: ActionTotals | null;
  clientCards: ClientCardsModel | null;
};

function clientCardsFailure(error: unknown): null {
  console.warn(`[dashboard] Cards do cliente indisponíveis: ${error instanceof Error ? error.message : String(error)}`);
  return null;
}

async function loadOverview(filters: DashboardFilters): Promise<Loaded> {
  const context = await getDashboardContext(filters);
  const prev = previousRange(context.range);
  const previousFilters = { ...filters, rangePreset: undefined, from: prev.from, to: prev.to };
  const [data, previous, actions, previousActions, clientCards] = await Promise.all([
    getDashboardData(filters),
    getDashboardData(previousFilters).catch(() => null),
    getDashboardActions(filters).catch(() => null),
    getDashboardActions(previousFilters).catch(() => null),
    context.filters.clientId ? getClientCards(filters).catch(clientCardsFailure) : null,
  ]);
  return { context, data, previous, actions, previousActions, clientCards };
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

  const { context, data, previous, actions, previousActions, clientCards } = loaded;

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
  const scope = syncScope(context);

  return (
    <div className="space-y-6">
      <OverviewStamp generatedAt={data.generatedAt} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs tabular-nums text-text-secondary">
          De {shortDate(model.range.from)} a {shortDate(model.range.to)}
          {model.previousRange && (
            <>
              {" "}
              · comparado com {shortDate(model.previousRange.from)} a {shortDate(model.previousRange.to)}
            </>
          )}
        </p>
        {model.hasData && <SyncNowButton accounts={scope} />}
      </div>

      {!model.hasData && (
        <Notice
          tone="warning"
          title="Sem métricas no banco para este período"
          description={`Conferido às ${noticeTime()} (horário de Brasília). Os números aparecem depois que a sincronização com a Meta grava os dias do período.`}
        >
          <SyncNowButton
            accounts={scope}
            variant="primary"
            secondary={
              <Link href="/settings/meta" className={secondaryLink}>
                Integrações → Meta Ads
              </Link>
            }
          />
        </Notice>
      )}

      <DashboardClient model={model} clientCards={clientCards} />
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

function ChannelSection({ platform, filters }: { platform: "google" | "all"; filters: DashboardFilters }) {
  if (!filters.clientId) {
    return (
      <Notice
        tone="neutral"
        title="Escolha um cliente no topo"
        description="A visão Google e a visão Meta + Google mostram os números de um cliente por vez."
      />
    );
  }
  const today = todayInTimezone(NOTICE_TIMEZONE);
  const range =
    filters.from && filters.to
      ? { from: filters.from, to: filters.to }
      : (resolvePreset(filters.rangePreset ?? DEFAULT_PRESET, today) ?? { from: today, to: today });
  return platform === "all" ? (
    <ChannelOverview clientId={filters.clientId} from={range.from} to={range.to} />
  ) : (
    <GoogleAdsDashboard controlled={{ clientId: filters.clientId, from: range.from, to: range.to }} />
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const platform = getParam(raw, "platform");

  if (platform === "google" || platform === "all") {
    return (
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Visão geral</h1>
          <p className="mt-1 truncate text-sm text-text-secondary">
            {platform === "all" ? "Meta Ads e Google Ads lado a lado" : "Como o Google Ads está indo no período"}
          </p>
        </div>
        <ChannelSection platform={platform} filters={filters} />
      </div>
    );
  }

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
