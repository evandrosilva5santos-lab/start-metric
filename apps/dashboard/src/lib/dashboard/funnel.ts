export type ActionCounts = Record<string, number>;

export type ActionCoverage = "complete" | "partial" | "none";

export type ActionTotals = {
  coverage: ActionCoverage;
  total: ActionCounts;
  byDay: Record<string, ActionCounts>;
  byCampaign: Record<string, ActionCounts>;
};

export type ActionRow = {
  date: string;
  campaign_id: string;
  actions: Record<string, unknown> | null;
};

export type PrimaryType = "compras" | "leads" | "mensagens";

export type ActionResults = {
  results: number;
  primaryType: PrimaryType;
  purchases: number;
  leads: number;
  messages: number;
  linkClicks: number;
  landingPageViews: number;
  checkouts: number;
};

export type FunnelStep = {
  nome: string;
  valor: number | null;
  pctAnterior: number | null;
};

export type Gargalo = { etapa: string; explicacao: string; resolvido: boolean };

export type FunnelModel = {
  etapas: FunnelStep[];
  gargalo: Gargalo;
  aguardandoSync: boolean;
};

const PURCHASE_KEYS = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];
const LEAD_KEYS = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_complete_registration_add_meta_leads",
  "offsite_conversion.fb_pixel_lead",
];
const MESSAGE_KEYS = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply",
];

function toCount(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function addCounts(target: ActionCounts, source: Record<string, unknown>): ActionCounts {
  const next = { ...target };
  for (const [key, raw] of Object.entries(source)) {
    const value = toCount(raw);
    if (value !== null) next[key] = (next[key] ?? 0) + value;
  }
  return next;
}

export function summarizeActionRows(rows: readonly ActionRow[]): ActionTotals {
  const withActions = rows.filter((row) => row.actions !== null && typeof row.actions === "object");
  const coverage: ActionCoverage =
    withActions.length === 0 ? "none" : withActions.length === rows.length ? "complete" : "partial";

  let total: ActionCounts = {};
  const byDay: Record<string, ActionCounts> = {};
  const byCampaign: Record<string, ActionCounts> = {};
  for (const row of withActions) {
    const actions = row.actions as Record<string, unknown>;
    total = addCounts(total, actions);
    byDay[row.date] = addCounts(byDay[row.date] ?? {}, actions);
    byCampaign[row.campaign_id] = addCounts(byCampaign[row.campaign_id] ?? {}, actions);
  }
  return { coverage, total, byDay, byCampaign };
}

function firstPresent(counts: ActionCounts, keys: readonly string[]): number {
  const key = keys.find((candidate) => counts[candidate] !== undefined);
  return key ? counts[key] : 0;
}

export function extractActionResults(counts: ActionCounts): ActionResults {
  const purchases = firstPresent(counts, PURCHASE_KEYS);
  const leads = firstPresent(counts, LEAD_KEYS);
  const messages = firstPresent(counts, MESSAGE_KEYS);

  let primaryType: PrimaryType = "leads";
  let results = leads;
  if (purchases > 0 && purchases >= leads) {
    primaryType = "compras";
    results = purchases;
  } else if (leads === 0 && messages > 0) {
    primaryType = "mensagens";
    results = messages;
  }

  return {
    results,
    primaryType,
    purchases,
    leads,
    messages,
    linkClicks: counts.link_click ?? 0,
    landingPageViews: counts.landing_page_view ?? counts.offsite_content_view ?? 0,
    checkouts: counts.initiate_checkout ?? counts.omni_initiated_checkout ?? 0,
  };
}

const RESULT_STEP_NAME: Record<PrimaryType, string> = {
  compras: "Compras",
  leads: "Resultados (leads)",
  mensagens: "Resultados (mensagens)",
};

function rate(value: number | null, base: number | null): number | null {
  if (value === null || base === null || base <= 0) return null;
  return (value / base) * 100;
}

const BALANCED: Gargalo = { etapa: "Nenhum", explicacao: "Funil equilibrado no período.", resolvido: true };

const NO_DATA: Gargalo = { etapa: "—", explicacao: "Sem métricas no período para apontar um gargalo.", resolvido: false };

const PENDING: Gargalo = {
  etapa: "—",
  explicacao: "As ações da Meta (visitas, início de ação e resultados) ainda não foram sincronizadas para todo o período.",
  resolvido: false,
};

function findGargalo(
  impressions: number,
  linkClicks: number,
  landing: number,
  checkouts: number,
  results: number,
): Gargalo {
  const impToClick = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
  const clickToPage = linkClicks > 0 ? (landing / linkClicks) * 100 : 0;
  const pageToCheckout = landing > 0 ? (checkouts / landing) * 100 : 0;
  const checkoutToResult = checkouts > 0 ? (results / checkouts) * 100 : 0;

  if (impToClick < 0.8 && impressions > 1000) {
    return {
      etapa: "Criativo (impressão → clique)",
      explicacao: `CTR baixo (${impToClick.toFixed(2)}%). Os anúncios não estão capturando a atenção do público nos primeiros segundos.`,
      resolvido: false,
    };
  }
  if (landing > 0 && clickToPage < 65 && linkClicks > 50) {
    return {
      etapa: "Carregamento do site (clique → visita)",
      explicacao: `Apenas ${clickToPage.toFixed(1)}% dos que clicam chegam a abrir sua página. O site pode estar lento ou o pixel com atraso.`,
      resolvido: false,
    };
  }
  if (pageToCheckout < 3 && landing > 100) {
    return {
      etapa: "Proposta da página (visita → checkout/formulário)",
      explicacao: `Muitos visitantes na página (${landing}), mas poucos iniciam conversão (${pageToCheckout.toFixed(1)}%). Oferta ou botão de ação precisam de mais clareza.`,
      resolvido: false,
    };
  }
  if (checkoutToResult < 25 && checkouts > 10) {
    return {
      etapa: "Fechamento (início → conclusão)",
      explicacao: `Alta desistência no fechamento (apenas ${checkoutToResult.toFixed(1)}% finalizam). Verifique atrito no checkout ou formulário extenso.`,
      resolvido: false,
    };
  }
  return BALANCED;
}

export function buildFunnel(
  impressions: number | null,
  clicks: number | null,
  actions: ActionTotals | null,
): FunnelModel {
  const complete = actions?.coverage === "complete";
  const extracted = complete ? extractActionResults(actions.total) : null;
  const linkClicks = extracted ? extracted.linkClicks || clicks : null;
  const landing = extracted ? extracted.landingPageViews : null;
  const checkouts = extracted ? extracted.checkouts : null;
  const results = extracted ? extracted.results : null;
  const lastName = extracted ? RESULT_STEP_NAME[extracted.primaryType] : "Resultados";

  const etapas: FunnelStep[] = [
    { nome: "Impressões", valor: impressions, pctAnterior: null },
    { nome: "Cliques no link", valor: linkClicks, pctAnterior: rate(linkClicks, impressions) },
    { nome: "Visitas à página", valor: landing, pctAnterior: rate(landing, linkClicks) },
    { nome: "Início de ação", valor: checkouts, pctAnterior: rate(checkouts, landing) },
    { nome: lastName, valor: results, pctAnterior: rate(results, checkouts) },
  ];

  const gargalo =
    impressions === null
      ? NO_DATA
      : extracted && linkClicks !== null
        ? findGargalo(impressions, linkClicks, extracted.landingPageViews, extracted.checkouts, extracted.results)
        : PENDING;

  return { etapas, gargalo, aguardandoSync: !complete && impressions !== null };
}
