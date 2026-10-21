export type CardFormat = "currency" | "percent" | "number" | "ratio";
export type CardSense = "good" | "bad" | "neutral";
export type CardGroup = "investment" | "delivery" | "clicks" | "messages" | "leads" | "sales" | "costs";
export type CardRequirement = "core" | "actions";

export type CardMetrics = Readonly<Record<string, number>>;

export interface CardDefinition {
  slug: string;
  label: string;
  group: CardGroup;
  format: CardFormat;
  sense: CardSense;
  hint: string;
  requires: CardRequirement;
  zeroWhenAbsent: boolean;
  compute: (metrics: CardMetrics) => number | undefined;
}

export const MAX_CARDS = 12;

export const CARD_GROUPS: readonly { id: CardGroup; label: string }[] = [
  { id: "investment", label: "Investimento" },
  { id: "delivery", label: "Entrega" },
  { id: "clicks", label: "Cliques" },
  { id: "messages", label: "Mensagens" },
  { id: "leads", label: "Leads" },
  { id: "sales", label: "Vendas" },
  { id: "costs", label: "Custos" },
];

const MESSAGE_ACTIONS = [
  "onsite_conversion_messaging_conversation_started_7d",
  "onsite_conversion_messaging_first_reply",
  "messaging_first_reply",
];
const LEAD_ACTIONS = ["lead", "onsite_web_lead", "onsite_conversion_lead_grouped", "fb_pixel_lead"];
const PURCHASE_ACTIONS = ["purchase", "omni_purchase", "fb_pixel_purchase"];
const REGISTRATION_ACTIONS = ["complete_registration", "omni_complete_registration", "fb_pixel_complete_registration"];
const CART_ACTIONS = ["add_to_cart", "omni_add_to_cart", "fb_pixel_add_to_cart"];
const CHECKOUT_ACTIONS = ["initiate_checkout", "omni_initiated_checkout", "fb_pixel_initiate_checkout"];
const LANDING_ACTIONS = ["landing_page_view", "omni_landing_page_view"];
const ENGAGEMENT_ACTIONS = ["post_engagement"];

function firstOf(metrics: CardMetrics, prefix: string, types: readonly string[]): number | undefined {
  const key = types.map((type) => `${prefix}.${type}`).find((candidate) => metrics[candidate] !== undefined);
  return key === undefined ? undefined : metrics[key];
}

function divide(numerator: number | undefined, denominator: number | undefined): number | undefined {
  if (numerator === undefined || denominator === undefined || denominator === 0) return undefined;
  return numerator / denominator;
}

const count = (types: readonly string[]) => (m: CardMetrics) => firstOf(m, "meta_actions", types);
const costPer = (types: readonly string[]) => (m: CardMetrics) => divide(m.meta_spend, firstOf(m, "meta_actions", types));
const field = (key: string) => (m: CardMetrics) => m[key];

function attributedRevenue(m: CardMetrics): number | undefined {
  const attributed = m.meta_roas !== undefined && m.meta_spend !== undefined ? m.meta_roas * m.meta_spend : undefined;
  if (attributed !== undefined && attributed > 0) return attributed;
  return firstOf(m, "meta_action_values", PURCHASE_ACTIONS) ?? attributed;
}

function roas(m: CardMetrics): number | undefined {
  if (m.meta_roas !== undefined && m.meta_roas > 0) return m.meta_roas;
  return divide(firstOf(m, "meta_action_values", PURCHASE_ACTIONS), m.meta_spend) ?? m.meta_roas;
}

type Spec = Omit<CardDefinition, "requires" | "zeroWhenAbsent"> & Partial<Pick<CardDefinition, "requires" | "zeroWhenAbsent">>;

const actionCount = (spec: Omit<Spec, "format" | "sense"> & { sense?: CardSense }): Spec => ({
  format: "number",
  sense: "good",
  requires: "actions",
  zeroWhenAbsent: true,
  ...spec,
});

const actionCost = (spec: Omit<Spec, "format" | "sense">): Spec => ({
  format: "currency",
  sense: "bad",
  requires: "actions",
  ...spec,
});

const SPECS: readonly Spec[] = [
  { slug: "meta_spend", label: "Investimento", group: "investment", format: "currency", sense: "neutral", hint: "Gasto no período", compute: field("meta_spend") },
  { slug: "meta_impressions", label: "Impressões", group: "delivery", format: "number", sense: "good", hint: "Vezes que os anúncios apareceram", compute: field("meta_impressions") },
  actionCount({ slug: "meta_actions.post_engagement", label: "Engajamentos", group: "delivery", hint: "Interações com as publicações", compute: count(ENGAGEMENT_ACTIONS) }),
  { slug: "meta_clicks", label: "Cliques", group: "clicks", format: "number", sense: "good", hint: "Cliques registrados no período", compute: field("meta_clicks") },
  { slug: "meta_ctr", label: "CTR", group: "clicks", format: "percent", sense: "good", hint: "Cliques ÷ impressões", compute: field("meta_ctr") },
  actionCount({ slug: "meta_actions.landing_page_view", label: "Visualizações da página", group: "clicks", hint: "Página de destino carregada", compute: count(LANDING_ACTIONS) }),
  { slug: "conversion_rate", label: "Taxa de conversão", group: "clicks", format: "percent", sense: "good", hint: "Conversões ÷ cliques", compute: field("conversion_rate") },
  actionCount({ slug: "meta_actions.onsite_conversion_messaging_first_reply", label: "Mensagens iniciadas", group: "messages", hint: "Conversas iniciadas no WhatsApp/Direct", compute: count(MESSAGE_ACTIONS) }),
  actionCost({ slug: "meta_cost_per_action.onsite_conversion_messaging_first_reply", label: "Custo por mensagem", group: "messages", hint: "Gasto ÷ mensagens iniciadas", compute: costPer(MESSAGE_ACTIONS) }),
  actionCount({ slug: "meta_actions.lead", label: "Leads", group: "leads", hint: "Cadastros de formulário e site", compute: count(LEAD_ACTIONS) }),
  actionCost({ slug: "meta_cost_per_action.lead", label: "Custo por lead", group: "leads", hint: "Gasto ÷ leads", compute: costPer(LEAD_ACTIONS) }),
  actionCount({ slug: "meta_actions.complete_registration", label: "Cadastros completos", group: "leads", hint: "Registros concluídos no site", compute: count(REGISTRATION_ACTIONS) }),
  { slug: "meta_action_values.purchase", label: "Receita", group: "sales", format: "currency", sense: "good", hint: "Receita atribuída às campanhas", compute: attributedRevenue },
  { slug: "meta_roas", label: "ROAS", group: "sales", format: "ratio", sense: "good", hint: "Receita ÷ gasto", compute: roas },
  actionCount({ slug: "meta_actions.purchase", label: "Compras", group: "sales", hint: "Compras rastreadas", compute: count(PURCHASE_ACTIONS) }),
  actionCost({ slug: "meta_cost_per_action.purchase", label: "Custo por compra", group: "sales", hint: "Gasto ÷ compras (CPA)", compute: costPer(PURCHASE_ACTIONS) }),
  actionCount({ slug: "meta_actions.add_to_cart", label: "Adições ao carrinho", group: "sales", hint: "Produtos colocados no carrinho", compute: count(CART_ACTIONS) }),
  actionCount({ slug: "meta_actions.initiate_checkout", label: "Checkouts iniciados", group: "sales", hint: "Início de finalização de compra", compute: count(CHECKOUT_ACTIONS) }),
  { slug: "meta_cpc", label: "CPC", group: "costs", format: "currency", sense: "bad", hint: "Gasto ÷ cliques", compute: field("meta_cpc") },
  { slug: "meta_cpm", label: "CPM", group: "costs", format: "currency", sense: "bad", hint: "Custo por mil impressões", compute: field("meta_cpm") },
  actionCost({ slug: "meta_cost_per_action.landing_page_view", label: "Custo por visualização da página", group: "costs", hint: "Gasto ÷ visualizações da página", compute: costPer(LANDING_ACTIONS) }),
];

export const CARD_CATALOG: readonly CardDefinition[] = SPECS.map((spec) => ({
  requires: "core",
  zeroWhenAbsent: false,
  ...spec,
}));

export const CARD_BY_SLUG: ReadonlyMap<string, CardDefinition> = new Map(CARD_CATALOG.map((card) => [card.slug, card]));

export function groupLabel(group: CardGroup): string {
  return CARD_GROUPS.find((g) => g.id === group)?.label ?? group;
}
