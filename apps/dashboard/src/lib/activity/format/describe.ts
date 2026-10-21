// Títulos e frases em português para eventos da Meta, a partir dos valores normalizados.
// Nunca usa o texto cru do extra_data: centavos viram moeda, códigos viram rótulos,
// e o título é derivado do dado (não do título traduzido da Meta, que pode contradizê-lo).

import { classifyActivity } from "../classify";
import type { ActivityDescription, ActivityValue, BudgetValue, NormalizedActivity, StatusValue, TargetingValue } from "../types";

const LEVEL_NOUN: Record<string, { noun: string; feminine: boolean }> = {
  campaign: { noun: "Campanha", feminine: true },
  ad_set: { noun: "Conjunto", feminine: false },
  ad: { noun: "Anúncio", feminine: false },
};

const BID_STRATEGY_LABEL: Record<string, string> = {
  LOWEST_COST_BID_STRATEGY: "Menor custo",
  LOWEST_COST_WITHOUT_CAP: "Menor custo",
  COST_CAP: "Limite de custo",
  LOWEST_COST_WITH_BID_CAP: "Limite de lance",
  LOWEST_COST_WITH_MIN_ROAS: "ROAS mínimo",
};

const FIXED_TITLES: Record<string, string> = {
  "ad.created": "Anúncio criado",
  "ad.creative_changed": "Criativo do anúncio alterado",
  "creative_library.image_added": "Imagem adicionada à biblioteca",
  "creative_library.image_edited": "Imagem editada na biblioteca",
  "creative_library.video_added": "Vídeo adicionado à biblioteca",
  "ad_set.created": "Conjunto de anúncios criado",
  "campaign.created": "Campanha criada",
  "audience.created": "Público criado",
  "audience.updated": "Público atualizado",
  "audience.deleted": "Público excluído",
  "audience.shared": "Público compartilhado",
  "ad_set.optimization_goal_changed": "Meta de desempenho alterada",
  "ad_set.bid_strategy_changed": "Estratégia de lance alterada",
  "ad_set.schedule_changed": "Programação alterada",
  "account.billing_charge": "Conta cobrada",
  "account.billing_refund": "Reembolso na conta",
  "account.funds_added": "Saldo adicionado",
  "account.spend_limit_changed": "Limite de gastos alterado",
  "account.spend_limit_reset": "Limite de gastos redefinido",
  "account.status_changed": "Status da conta alterado",
  "ad.first_delivery": "Anúncio começou a ser exibido",
};

const MONEY_ACTIONS = new Set(["account.billing_charge", "account.billing_refund", "account.funds_added"]);

const minorDigitsCache = new Map<string, number>();
function minorDigits(currency: string): number {
  const cached = minorDigitsCache.get(currency);
  if (cached !== undefined) return cached;
  const digits = new Intl.NumberFormat("pt-BR", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  minorDigitsCache.set(currency, digits);
  return digits;
}

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  const digits = minorDigits(currency);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amountMinor / 10 ** digits);
}

const isBudget = (v: ActivityValue | null): v is BudgetValue => !!v && "amountMinor" in v;
const isStatus = (v: ActivityValue | null): v is StatusValue => !!v && "statusCode" in v;
const isTargeting = (v: ActivityValue | null): v is TargetingValue => !!v && "items" in v;
const scalarOf = (v: ActivityValue | null) => (v && "value" in v ? v.value : null);
const nameOf = (v: ActivityValue | null) => (v && "name" in v ? v.name : null);

const money = (v: BudgetValue | null) =>
  v && v.amountMinor !== null && v.currency ? formatMoneyMinor(v.amountMinor, v.currency) : "—";
const perDay = (v: BudgetValue | null) => (v?.period === "daily" ? " por dia" : "");

function withObject(n: NormalizedActivity, change: string | null): string {
  return [n.objectName, change].filter((part): part is string => !!part).join(" · ");
}

function budgetText(n: NormalizedActivity): ActivityDescription {
  const before = isBudget(n.before) ? n.before : null;
  const after = isBudget(n.after) ? n.after : null;
  const period = after?.period ?? before?.period ?? null;
  const title = period === "daily" ? "Orçamento diário alterado" : period === "lifetime" ? "Orçamento total alterado" : "Orçamento alterado";
  const change = before ? `de ${money(before)} para ${money(after)}${perDay(after ?? before)}` : `${money(after)}${perDay(after)}`;
  return { title, detail: withObject(n, change) };
}

function statusText(n: NormalizedActivity, action: string): ActivityDescription {
  const level = LEVEL_NOUN[n.objectLevel] ?? { noun: "Item", feminine: false };
  const ending = level.feminine ? "a" : "o";
  const verb = action.endsWith(".paused")
    ? `pausad${ending}`
    : action.endsWith(".activated")
      ? `ativad${ending}`
      : action.endsWith(".review_transition")
        ? "em análise pela Meta"
        : "com status alterado";
  const before = isStatus(n.before) ? n.before.label : null;
  const after = isStatus(n.after) ? n.after.label : null;
  const change = before && after ? `de ${before} para ${after}` : after;
  return { title: `${level.noun} ${verb}`, detail: withObject(n, change) };
}

function targetingText(n: NormalizedActivity): ActivityDescription {
  const before = isTargeting(n.before) ? n.before.items : [];
  const after = isTargeting(n.after) ? n.after.items : [];
  const oldByLabel = new Map(before.map((i) => [i.label, i.values.join(", ")]));
  const diffs = after
    .filter((i) => oldByLabel.get(i.label) !== i.values.join(", "))
    .map((i) => `${i.label} ${oldByLabel.get(i.label) || "—"} → ${i.values.join(", ") || "—"}`);
  return { title: "Direcionamento alterado", detail: withObject(n, diffs.join("; ") || null) };
}

export function describeActivity(n: NormalizedActivity): ActivityDescription {
  const { action } = classifyActivity(n);

  if (action.endsWith(".budget_changed")) return budgetText(n);
  if (action.endsWith(".budget_schedule_changed")) {
    const on = scalarOf(n.after) === true;
    return { title: on ? "Programação de orçamento ativada" : "Programação de orçamento desativada", detail: withObject(n, null) };
  }
  if (n.valueKind === "status") return statusText(n, action);
  if (action.endsWith(".targeting_changed")) return targetingText(n);
  if (action.endsWith(".renamed")) {
    return { title: "Nome alterado", detail: `de ${nameOf(n.before) ?? "—"} para ${nameOf(n.after) ?? "—"}` };
  }
  if ((action === "campaign.created" || action === "ad_set.created") && isBudget(n.after)) {
    return { title: FIXED_TITLES[action], detail: withObject(n, `orçamento ${money(n.after)}${perDay(n.after)}`) };
  }
  if (action === "ad_set.bid_strategy_changed") {
    const code = scalarOf(n.after);
    const label = typeof code === "string" ? (BID_STRATEGY_LABEL[code] ?? code) : null;
    return { title: FIXED_TITLES[action], detail: withObject(n, label) };
  }
  if (action === "ad_set.optimization_goal_changed") {
    const goal = scalarOf(n.after);
    return { title: FIXED_TITLES[action], detail: withObject(n, typeof goal === "string" ? goal : null) };
  }
  if (MONEY_ACTIONS.has(action)) {
    return { title: FIXED_TITLES[action], detail: withObject(n, money(isBudget(n.after) ? n.after : null)) };
  }
  const title = FIXED_TITLES[action] ?? n.translatedTitle ?? "Alteração registrada na Meta";
  return { title, detail: withObject(n, null) };
}
