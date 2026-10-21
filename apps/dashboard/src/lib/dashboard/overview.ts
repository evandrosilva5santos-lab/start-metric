import type { Aviso } from "@/lib/meta/dados-types";
import { addDays, shortDate, type DateRange } from "./overview-range";
import { buildFunnel, extractActionResults, type ActionTotals, type FunnelModel, type PrimaryType } from "./funnel";
import type { DashboardCampaignRow, DashboardData } from "./types";

export type OverviewKpis = {
  spend: number | null;
  conversions: number | null;
  cpa: number | null;
  roas: number | null;
  ctr: number | null;
  cpm: number | null;
  impressions: number | null;
  clicks: number | null;
};

export type OverviewVariations = Partial<Record<"spend" | "conversions" | "cpa" | "roas", number>>;

export type OverviewDailyPoint = {
  date: string;
  label: string;
  spend: number;
  results: number;
  cpr: number | null;
};

export type OverviewCampaign = {
  id: string;
  name: string;
  accountName: string;
  spend: number;
  conversions: number;
  cpa: number | null;
  situacao: "ATIVA" | "SEM_ENTREGA" | "PAUSADA" | "OUTRA";
  situacaoLabel: string;
};

export type OverviewModel = {
  range: DateRange;
  previousRange: DateRange | null;
  timezone: string;
  generatedAt: string;
  hasData: boolean;
  hasRevenue: boolean;
  kpis: OverviewKpis;
  variations: OverviewVariations;
  daily: OverviewDailyPoint[];
  funnel: FunnelModel;
  primaryType: PrimaryType | null;
  linkClicks: boolean;
  topCampaigns: OverviewCampaign[];
  avisos: Aviso[];
};

const TOP_CAMPAIGNS = 5;
const MAX_AVISOS = 3;

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function percentChange(current: number | null, previous: number | null | undefined): number | undefined {
  if (current === null || previous === null || previous === undefined || previous === 0) return undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

type ResultSource = {
  total: number | null;
  linkClicks: number | null;
  primaryType: PrimaryType | null;
  byDay: (date: string, fallback: number) => number;
  byCampaign: (id: string, fallback: number) => number;
};

function completeActions(actions: ActionTotals | null): ActionTotals | null {
  return actions?.coverage === "complete" ? actions : null;
}

function resultSource(actions: ActionTotals | null): ResultSource {
  const complete = completeActions(actions);
  if (!complete) {
    return {
      total: null,
      linkClicks: null,
      primaryType: null,
      byDay: (_date, fallback) => fallback,
      byCampaign: (_id, fallback) => fallback,
    };
  }
  const total = extractActionResults(complete.total);
  return {
    total: total.results,
    linkClicks: total.linkClicks > 0 ? total.linkClicks : null,
    primaryType: total.primaryType,
    byDay: (date) => extractActionResults(complete.byDay[date] ?? {}).results,
    byCampaign: (id) => extractActionResults(complete.byCampaign[id] ?? {}).results,
  };
}

function buildKpis(data: DashboardData, source: ResultSource): OverviewKpis {
  if (data.chart.length === 0) {
    return {
      spend: null,
      conversions: null,
      cpa: null,
      roas: null,
      ctr: null,
      cpm: null,
      impressions: null,
      clicks: null,
    };
  }
  const k = data.kpis;
  const results = source.total ?? k.attributedConversions;
  const clicks = source.linkClicks ?? k.clicks;
  const ctr = ratio(clicks, k.impressions);
  const cpm = ratio(k.adSpend, k.impressions);
  return {
    spend: k.adSpend,
    conversions: results,
    cpa: ratio(k.adSpend, results),
    roas: k.revenueAttributed > 0 ? ratio(k.revenueAttributed, k.adSpend) : null,
    ctr: ctr === null ? null : ctr * 100,
    cpm: cpm === null ? null : cpm * 1000,
    impressions: k.impressions,
    clicks,
  };
}

function situationOf(row: DashboardCampaignRow): Pick<OverviewCampaign, "situacao" | "situacaoLabel"> {
  const status = row.status.toUpperCase();
  if (status === "ACTIVE") {
    return row.spend > 0
      ? { situacao: "ATIVA", situacaoLabel: "Ativa" }
      : { situacao: "SEM_ENTREGA", situacaoLabel: "Sem entrega" };
  }
  if (status === "PAUSED") return { situacao: "PAUSADA", situacaoLabel: "Pausada" };
  if (status === "ARCHIVED") return { situacao: "OUTRA", situacaoLabel: "Arquivada" };
  if (status === "DELETED") return { situacao: "OUTRA", situacaoLabel: "Excluída" };
  return { situacao: "OUTRA", situacaoLabel: row.status };
}

const SITUATION_ORDER: Record<OverviewCampaign["situacao"], number> = {
  ATIVA: 0,
  SEM_ENTREGA: 1,
  PAUSADA: 2,
  OUTRA: 3,
};

function buildTopCampaigns(rows: DashboardCampaignRow[], source: ResultSource): OverviewCampaign[] {
  return rows
    .filter((row) => row.spend > 0 || row.status.toUpperCase() === "ACTIVE")
    .map((row) => {
      const results = source.byCampaign(row.campaignId, row.conversions);
      return {
        id: row.campaignId,
        name: row.campaignName,
        accountName: row.accountName,
        spend: row.spend,
        conversions: results,
        cpa: ratio(row.spend, results),
        ...situationOf(row),
      };
    })
    .sort((a, b) => SITUATION_ORDER[a.situacao] - SITUATION_ORDER[b.situacao] || b.spend - a.spend)
    .slice(0, TOP_CAMPAIGNS);
}

function buildDaily(data: DashboardData, source: ResultSource): OverviewDailyPoint[] {
  return data.chart.map((point) => {
    const results = source.byDay(point.date, point.conversions);
    return {
      date: point.date,
      label: shortDate(point.date),
      spend: point.spend,
      results,
      cpr: ratio(point.spend, results),
    };
  });
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function buildAvisos(data: DashboardData, today: string, source: ResultSource): Aviso[] {
  const avisos: Aviso[] = [];
  const { from, to } = data.range;

  const spentWithoutResult = data.campaigns
    .filter((c) => c.spend > 0 && source.byCampaign(c.campaignId, c.conversions) === 0)
    .sort((a, b) => b.spend - a.spend);
  if (spentWithoutResult.length > 0) {
    const n = spentWithoutResult.length;
    avisos.push({
      tipo: "alerta",
      titulo: `${n} ${plural(n, "campanha gastou", "campanhas gastaram")} sem resultado`,
      descricao: `Nenhuma conversão registrada entre ${shortDate(from)} e ${shortDate(to)}. A de maior gasto é “${spentWithoutResult[0].campaignName}”.`,
      acao: "Revise o evento de conversão e os criativos dessas campanhas.",
    });
  }

  const lastDay = data.chart.at(-1)?.date;
  const yesterday = addDays(today, -1);
  if (lastDay && to >= yesterday && lastDay < yesterday) {
    avisos.push({
      tipo: "atencao",
      titulo: `Sem dados desde ${shortDate(lastDay)}`,
      descricao: `O último dia com métricas no banco é ${shortDate(lastDay)}. Os dias seguintes ainda não foram sincronizados.`,
      acao: "Rode a sincronização em Integrações → Meta Ads.",
    });
  }

  const activeWithoutDelivery = data.campaigns.filter(
    (c) => c.status.toUpperCase() === "ACTIVE" && c.spend === 0,
  );
  if (activeWithoutDelivery.length > 0) {
    const n = activeWithoutDelivery.length;
    avisos.push({
      tipo: "atencao",
      titulo: `${n} ${plural(n, "campanha ativa", "campanhas ativas")} sem entrega`,
      descricao: `${plural(n, "Está ativa", "Estão ativas")}, mas não ${plural(n, "gastou", "gastaram")} nada no período.`,
      acao: "Confira orçamento, público e aprovação dos anúncios em Campanhas.",
    });
  }

  if (data.kpis.adSpend > 0 && data.kpis.revenueAttributed === 0) {
    avisos.push({
      tipo: "info",
      titulo: "Sem receita rastreada",
      descricao: "Nenhuma compra com valor chegou no período, por isso o ROAS aparece como —.",
      acao: "Confira o pixel e a API de Conversões em Rastreamento.",
    });
  }

  return avisos.slice(0, MAX_AVISOS);
}

export type OverviewActions = { current: ActionTotals | null; previous: ActionTotals | null };

export function buildOverviewModel(
  data: DashboardData,
  previous: DashboardData | null,
  today: string,
  actions: OverviewActions = { current: null, previous: null },
): OverviewModel {
  const source = resultSource(actions.current);
  const previousSource = resultSource(source.total === null ? null : actions.previous);
  const kpis = buildKpis(data, source);
  const previousKpis = previous ? buildKpis(previous, previousSource) : null;
  const comparable = source.total === null || previousSource.total !== null;

  return {
    range: data.range,
    previousRange: previous?.range ?? null,
    timezone: data.timezone,
    generatedAt: data.generatedAt,
    hasData: data.chart.length > 0,
    hasRevenue: data.kpis.revenueAttributed > 0,
    kpis,
    variations: {
      spend: percentChange(kpis.spend, previousKpis?.spend),
      conversions: comparable ? percentChange(kpis.conversions, previousKpis?.conversions) : undefined,
      cpa: comparable ? percentChange(kpis.cpa, previousKpis?.cpa) : undefined,
      roas: percentChange(kpis.roas, previousKpis?.roas),
    },
    daily: buildDaily(data, source),
    funnel: buildFunnel(kpis.impressions, data.chart.length > 0 ? data.kpis.clicks : null, actions.current),
    primaryType: source.primaryType,
    linkClicks: source.linkClicks !== null,
    topCampaigns: buildTopCampaigns(data.campaigns, source),
    avisos: buildAvisos(data, today, source),
  };
}
