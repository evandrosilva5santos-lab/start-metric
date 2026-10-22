// Regras automáticas: decide, campanha por campanha, se a regra age e o que faria.
// Puro (sem rede/banco): o cron e o "testar agora" usam a mesma decisão.

export type AutomationMetric = "cpa" | "roas" | "ctr" | "cpc" | "cpm" | "spend" | "conversions";
export type AutomationOperator = "above" | "below";
export type AutomationAction = "pause" | "activate" | "decrease_budget" | "increase_budget" | "notify";
export type RunStatus = "simulated" | "executed" | "failed" | "skipped";

export type RuleInput = {
  id: string;
  metric: AutomationMetric;
  operator: AutomationOperator;
  value: number;
  /** Não age em campanha que gastou menos que isso no período (evita decidir com pouco dado). */
  minSpend: number;
  action: AutomationAction;
  actionPercent: number | null;
  cooldownHours: number;
  maxActionsPerDay: number;
};

export type EntitySnapshot = {
  externalId: string;
  name: string;
  status: string;
  dailyBudget: number | null;
  budgetShared: boolean;
  metrics: { spend: number; impressions: number; clicks: number; conversions: number; value: number };
};

export type RecentRun = { entityExternalId: string; createdAt: string; status: RunStatus };

export type Decision = {
  entity: EntitySnapshot;
  metricValue: number;
  action: AutomationAction;
  newBudget: number | null;
  /** Motivo de não agir (a condição bateu, mas uma trava impediu); null = age. */
  skipped: string | null;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MIN_BUDGET = 1;
const ACTIVE = new Set(["ACTIVE", "ENABLED"]);
const PAUSED = new Set(["PAUSED"]);

const ratio = (a: number, b: number, scale = 1): number | null => (b > 0 ? (a / b) * scale : null);

export function metricValue(entity: EntitySnapshot, metric: AutomationMetric): number | null {
  const m = entity.metrics;
  switch (metric) {
    case "cpa":
      // Gastou e não converteu: o pior CPA possível, para "CPA acima de X" pegar.
      if (m.conversions <= 0) return m.spend > 0 ? Infinity : null;
      return m.spend / m.conversions;
    case "roas":
      return ratio(m.value, m.spend);
    case "ctr":
      return ratio(m.clicks, m.impressions, 100);
    case "cpc":
      return ratio(m.spend, m.clicks);
    case "cpm":
      return ratio(m.spend, m.impressions, 1000);
    case "spend":
      return m.spend;
    case "conversions":
      return m.conversions;
  }
}

/** Novo orçamento diário arredondado para baixo em centavos; nunca abaixo de R$ 1. */
export function nextBudget(current: number, action: "increase_budget" | "decrease_budget", percent: number): number {
  const factor = action === "increase_budget" ? 1 + percent / 100 : 1 - percent / 100;
  const cents = Math.floor(Math.round(current * factor * 10_000) / 100);
  return Math.max(MIN_BUDGET, cents / 100);
}

function blockReason(rule: RuleInput, entity: EntitySnapshot): string | null {
  if (entity.metrics.spend < rule.minSpend) return "gasto abaixo do mínimo";
  if (rule.action === "pause" && !ACTIVE.has(entity.status)) return "já está pausada";
  if (rule.action === "activate" && !PAUSED.has(entity.status)) return "já está ativa";
  if (rule.action === "increase_budget" || rule.action === "decrease_budget") {
    if (entity.budgetShared) return "orçamento compartilhado";
    if (entity.dailyBudget === null || entity.dailyBudget <= 0) return "campanha sem orçamento diário próprio";
  }
  return null;
}

export function decide(rule: RuleInput, entities: readonly EntitySnapshot[], runs: readonly RecentRun[], now: Date): Decision[] {
  const counted = runs.filter((r) => r.status === "executed" || r.status === "simulated");
  const age = (r: RecentRun) => now.getTime() - Date.parse(r.createdAt);
  let actionsInDay = counted.filter((r) => age(r) < DAY).length;
  const decisions: Decision[] = [];

  for (const entity of entities) {
    const value = metricValue(entity, rule.metric);
    if (value === null) continue;
    const matches = rule.operator === "above" ? value > rule.value : value < rule.value;
    if (!matches) continue;

    let skipped = blockReason(rule, entity);
    if (!skipped && counted.some((r) => r.entityExternalId === entity.externalId && age(r) < rule.cooldownHours * HOUR)) {
      skipped = "em carência";
    }
    if (!skipped && actionsInDay >= rule.maxActionsPerDay) skipped = "limite diário atingido";

    const budgetAction = rule.action === "increase_budget" || rule.action === "decrease_budget";
    const newBudget =
      !skipped && budgetAction && entity.dailyBudget !== null
        ? nextBudget(entity.dailyBudget, rule.action as "increase_budget" | "decrease_budget", rule.actionPercent ?? 0)
        : null;
    if (!skipped) actionsInDay++;
    decisions.push({ entity, metricValue: value, action: rule.action, newBudget, skipped });
  }
  return decisions;
}
