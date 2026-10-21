// Classifica eventos da Meta: categoria, ação normalizada e se contam como trabalho do gestor.
// Só contam decisões de pessoa ou de integração. Automação da Meta, cobranças e
// transições de revisão (efeito colateral de publicar) nunca contam.
// Tipo desconhecido não é inventado como trabalho.

import type { ActivityCategory, ActivityClassification, NormalizedActivity, ObjectLevel, StatusValue } from "./types";

/** Suba a versão quando mudar uma regra: eventos já gravados podem ser reclassificados. */
export const CLASSIFIER_VERSION = 1;

// run_status da Meta: 1 = ativo, 15 = inativo/pausado, 9 = análise pendente, 17 = processo pendente.
const ACTIVE = 1;
const PAUSED = new Set([2, 15]);
const REVIEW_STATES = new Set([9, 17]);

const STATUS_EVENTS = new Set(["update_campaign_run_status", "update_ad_set_run_status", "update_ad_run_status"]);

type Rule = { category: ActivityCategory; action: (level: ObjectLevel) => string; counts?: boolean };
const fixed = (category: ActivityCategory, action: string, counts = true): Rule => ({ category, action: () => action, counts });
const leveled = (category: ActivityCategory, suffix: string): Rule => ({ category, action: (level) => `${level}.${suffix}` });

const RULES: Record<string, Rule> = {
  update_campaign_budget: leveled("budget", "budget_changed"),
  update_ad_set_budget: leveled("budget", "budget_changed"),
  update_campaign_budget_scheduling_state: leveled("budget", "budget_schedule_changed"),
  update_campaign_group_budget_scheduling_state: leveled("budget", "budget_schedule_changed"),
  update_ad_run_status_to_be_set_after_review: leveled("status", "status_after_review_set"),
  create_ad: leveled("creative", "created"),
  update_ad_creative: leveled("creative", "creative_changed"),
  add_images: fixed("creative", "creative_library.image_added"),
  edit_images: fixed("creative", "creative_library.image_edited"),
  add_videos: fixed("creative", "creative_library.video_added"),
  create_ad_set: leveled("structure", "created"),
  create_campaign_group: leveled("structure", "created"),
  update_ad_set_name: leveled("structure", "renamed"),
  update_campaign_name: leveled("structure", "renamed"),
  update_ad_name: leveled("structure", "renamed"),
  update_ad_set_duration: leveled("structure", "schedule_changed"),
  update_ad_set_target_spec: leveled("targeting", "targeting_changed"),
  update_ad_targets_spec: leveled("targeting", "targeting_changed"),
  create_audience: fixed("targeting", "audience.created"),
  update_audience: fixed("targeting", "audience.updated"),
  delete_audience: fixed("targeting", "audience.deleted"),
  share_audience: fixed("targeting", "audience.shared"),
  update_ad_set_optimization_goal: leveled("bidding", "optimization_goal_changed"),
  update_ad_set_bid_strategy: leveled("bidding", "bid_strategy_changed"),
  ad_account_billing_charge: fixed("billing", "account.billing_charge", false),
  ad_account_billing_refund: fixed("billing", "account.billing_refund", false),
  funding_event_successful: fixed("billing", "account.funds_added", false),
  ad_account_update_spend_limit: fixed("billing", "account.spend_limit_changed", false),
  ad_account_reset_spend_limit: fixed("billing", "account.spend_limit_reset", false),
  ad_account_update_status: fixed("platform", "account.status_changed", false),
  first_delivery_event: fixed("platform", "ad.first_delivery", false),
};

const statusCode = (v: unknown): number | null => (v && typeof v === "object" && "statusCode" in v ? (v as StatusValue).statusCode : null);

function classifyStatus(n: NormalizedActivity): ActivityClassification {
  const level = n.objectLevel;
  const from = statusCode(n.before);
  const to = statusCode(n.after);
  const human = n.actorKind === "person" || n.actorKind === "integration";
  if ((from !== null && REVIEW_STATES.has(from)) || (to !== null && REVIEW_STATES.has(to))) {
    return { category: human ? "status" : "platform", action: `${level}.review_transition`, countsAsWork: false };
  }
  const action = to === ACTIVE ? `${level}.activated` : to !== null && PAUSED.has(to) ? `${level}.paused` : `${level}.status_changed`;
  return human ? { category: "status", action, countsAsWork: true } : { category: "platform", action, countsAsWork: false };
}

export function classifyActivity(n: NormalizedActivity): ActivityClassification {
  if (STATUS_EVENTS.has(n.eventType)) return classifyStatus(n);
  const rule = RULES[n.eventType];
  if (!rule) return { category: "other", action: "unknown", countsAsWork: false };
  const action = rule.action(n.objectLevel);
  if (rule.counts === false) return { category: rule.category, action, countsAsWork: false };
  const human = n.actorKind === "person" || n.actorKind === "integration";
  return human ? { category: rule.category, action, countsAsWork: true } : { category: "platform", action, countsAsWork: false };
}
