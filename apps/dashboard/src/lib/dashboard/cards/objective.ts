export const OBJECTIVE_KINDS = ["sales", "leads", "messages", "traffic", "awareness"] as const;

export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number];

export interface CampaignSpend {
  objective: string | null;
  spend: number | null;
}

const META_OBJECTIVES: Readonly<Record<string, ObjectiveKind>> = {
  OUTCOME_SALES: "sales",
  CONVERSIONS: "sales",
  PRODUCT_CATALOG_SALES: "sales",
  OUTCOME_LEADS: "leads",
  LEAD_GENERATION: "leads",
  OUTCOME_ENGAGEMENT: "messages",
  MESSAGES: "messages",
  OUTCOME_TRAFFIC: "traffic",
  LINK_CLICKS: "traffic",
  OUTCOME_AWARENESS: "awareness",
  BRAND_AWARENESS: "awareness",
  REACH: "awareness",
  VIDEO_VIEWS: "awareness",
  POST_ENGAGEMENT: "awareness",
  PAGE_LIKES: "awareness",
};

const KIND_LABELS: Readonly<Record<ObjectiveKind, string>> = {
  sales: "vendas",
  leads: "leads",
  messages: "mensagens",
  traffic: "tráfego",
  awareness: "reconhecimento",
};

const SPEND = "meta_spend";
const CTR = "meta_ctr";
const CPM = "meta_cpm";
const CPC = "meta_cpc";
const CLICKS = "meta_clicks";
const IMPRESSIONS = "meta_impressions";
const LANDING = "meta_actions.landing_page_view";

const DEFAULT_LAYOUTS: Readonly<Record<ObjectiveKind | "general", readonly string[]>> = {
  messages: [
    SPEND,
    "meta_actions.onsite_conversion_messaging_first_reply",
    "meta_cost_per_action.onsite_conversion_messaging_first_reply",
    CTR,
    CPM,
    IMPRESSIONS,
    CLICKS,
    CPC,
  ],
  leads: [SPEND, "meta_actions.lead", "meta_cost_per_action.lead", CTR, CPC, CPM, LANDING, IMPRESSIONS],
  sales: [
    SPEND,
    "meta_action_values.purchase",
    "meta_roas",
    "meta_actions.purchase",
    "meta_cost_per_action.purchase",
    "meta_actions.initiate_checkout",
    CTR,
    CPM,
  ],
  traffic: [SPEND, CLICKS, CPC, CTR, LANDING, "meta_cost_per_action.landing_page_view", CPM, IMPRESSIONS],
  awareness: [SPEND, IMPRESSIONS, CPM, "meta_actions.post_engagement", CLICKS, CTR],
  general: [SPEND, IMPRESSIONS, CLICKS, CTR, CPC, CPM],
};

export function objectiveKindOf(objective: string | null | undefined): ObjectiveKind | null {
  if (!objective) return null;
  return META_OBJECTIVES[objective.trim().toUpperCase()] ?? null;
}

function positive(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function strongest(weights: ReadonlyMap<ObjectiveKind, number>): ObjectiveKind | null {
  let best: ObjectiveKind | null = null;
  for (const kind of OBJECTIVE_KINDS) {
    const weight = weights.get(kind) ?? 0;
    if (weight > 0 && (best === null || weight > (weights.get(best) ?? 0))) best = kind;
  }
  return best;
}

export function detectObjective(campaigns: readonly CampaignSpend[]): ObjectiveKind | null {
  const spend = new Map<ObjectiveKind, number>();
  const count = new Map<ObjectiveKind, number>();
  for (const campaign of campaigns) {
    const kind = objectiveKindOf(campaign.objective);
    if (!kind) continue;
    spend.set(kind, (spend.get(kind) ?? 0) + positive(campaign.spend));
    count.set(kind, (count.get(kind) ?? 0) + 1);
  }
  return strongest(spend) ?? strongest(count);
}

export function defaultLayoutFor(kind: ObjectiveKind | null): string[] {
  return [...DEFAULT_LAYOUTS[kind ?? "general"]];
}

export function defaultSourceLabel(kind: ObjectiveKind | null): string {
  return kind ? `Padrão para campanhas de ${KIND_LABELS[kind]}` : "Padrão geral (objetivo não identificado)";
}
