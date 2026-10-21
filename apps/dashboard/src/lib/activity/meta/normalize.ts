// Normaliza um evento de act_{id}/activities para o formato da Central de Histórico.
// Regras: nível do objeto pelo par (event_type, object_type); ids sempre texto;
// antes/depois sem URLs assinadas e com códigos numéricos quando a Meta os envia.

import { parseExtraData } from "./parse";
import type {
  ActivityValue,
  ActorKind,
  BudgetValue,
  NormalizedActivity,
  ObjectLevel,
  RawMetaActivity,
  TargetingItem,
  ValueKind,
} from "../types";

export type NormalizeContext = { accountExternalId: string; startMetricAppId: string | null };

const META_ACTOR_NAME = "Meta";

// Nomes legados da Meta: CAMPAIGN_GROUP = campanha, CAMPAIGN = conjunto, ADGROUP = anúncio.
const LEVEL_BY_OBJECT_TYPE: Record<string, ObjectLevel> = {
  CAMPAIGN_GROUP: "campaign",
  CAMPAIGN: "ad_set",
  ADGROUP: "ad",
  ACCOUNT: "account",
};

const AUDIENCE_EVENTS = new Set(["create_audience", "update_audience", "delete_audience", "share_audience"]);
const LIBRARY_EVENTS = new Set(["add_images", "edit_images", "add_videos", "edit_videos"]);
const BUDGET_EVENTS = new Set(["update_campaign_budget", "update_ad_set_budget", "create_campaign_group", "create_ad_set"]);
const BILLING_AMOUNT_EVENTS = new Set(["ad_account_billing_charge", "ad_account_billing_refund", "funding_event_successful"]);

type Extra = Record<string, unknown>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const asText = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
const asNumber = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const hasUrl = (v: unknown): boolean => typeof v === "string" && /https?:/i.test(v);

/** campaign_id pode vir como número ou como { mutation_input, new }. */
function idOf(v: unknown): string | null {
  if (isRecord(v)) return asText(v.new) ?? asText(v.mutation_input);
  return asText(v);
}

function objectLevelOf(raw: RawMetaActivity): ObjectLevel {
  if (AUDIENCE_EVENTS.has(raw.event_type)) return "audience";
  if (LIBRARY_EVENTS.has(raw.event_type)) return "creative_library";
  return LEVEL_BY_OBJECT_TYPE[raw.object_type ?? ""] ?? "other";
}

function actorKindOf(raw: RawMetaActivity, ctx: NormalizeContext): ActorKind {
  if (ctx.startMetricAppId && raw.application_id === ctx.startMetricAppId) return "integration";
  if (raw.actor_name === META_ACTOR_NAME && !raw.application_id) return "platform";
  return raw.actor_id ? "person" : "unknown";
}

/** "2026-10-13T12:35:10+0000" → "2026-10-13T12:35:10.000Z". */
export function metaTimeToIso(eventTime: string): string {
  const withColon = eventTime.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const time = Date.parse(withColon);
  if (!Number.isFinite(time)) throw new Error(`event_time inválido: ${eventTime}`);
  return new Date(time).toISOString();
}

function periodOf(label: unknown): BudgetValue["period"] {
  if (typeof label !== "string") return null;
  if (/dia/i.test(label)) return "daily";
  if (/vital|total/i.test(label)) return "lifetime";
  return null;
}

function budgetSide(side: unknown, amountKey: "old_value" | "new_value"): BudgetValue | null {
  if (!isRecord(side)) return null;
  return {
    amountMinor: asNumber(side[amountKey]),
    currency: asText(side.currency),
    period: periodOf(side.additional_value),
  };
}

function targetingSide(side: unknown): ActivityValue | null {
  if (!Array.isArray(side)) return null;
  const items: TargetingItem[] = side
    .filter(isRecord)
    .map((item) => ({
      label: String(item.content ?? "").trim(),
      values: Array.isArray(item.children) ? item.children.filter((c): c is string => typeof c === "string") : [],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return { items };
}

function scalarSide(v: unknown): ActivityValue | null {
  if (v === undefined || hasUrl(v)) return null;
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return { value: v };
  return null;
}

type Change = { valueKind: ValueKind; before: ActivityValue | null; after: ActivityValue | null };
const NO_CHANGE: Change = { valueKind: "none", before: null, after: null };

function changeOf(raw: RawMetaActivity, extra: Extra | null): Change {
  if (!extra || LIBRARY_EVENTS.has(raw.event_type) || raw.event_type === "update_ad_creative") return NO_CHANGE;
  const type = extra.type;

  if (type === "run_status" || type === "run_status_to_set_after_review") {
    const codes = isRecord(extra.run_status) ? extra.run_status : {};
    return {
      valueKind: "status",
      before: { statusCode: asNumber(codes.old_value), label: asText(extra.old_value) },
      after: { statusCode: asNumber(codes.new_value), label: asText(extra.new_value) },
    };
  }
  if (BILLING_AMOUNT_EVENTS.has(raw.event_type)) {
    return { valueKind: "budget", before: null, after: { amountMinor: asNumber(extra.new_value), currency: asText(extra.currency), period: null } };
  }
  if (BUDGET_EVENTS.has(raw.event_type) && (isRecord(extra.old_value) || isRecord(extra.new_value))) {
    return { valueKind: "budget", before: budgetSide(extra.old_value, "old_value"), after: budgetSide(extra.new_value, "new_value") };
  }
  if (type === "targets_spec" || Array.isArray(extra.old_value) || Array.isArray(extra.new_value)) {
    return { valueKind: "targeting", before: targetingSide(extra.old_value), after: targetingSide(extra.new_value) };
  }
  if (type === "name") {
    return { valueKind: "name", before: { name: asText(extra.old_value) }, after: { name: asText(extra.new_value) } };
  }
  if (type === "duration" && (isRecord(extra.old_value) || isRecord(extra.new_value))) {
    const side = (v: unknown) => (isRecord(v) ? { start: asText(v.time_start), stop: asText(v.time_stop) } : null);
    return { valueKind: "schedule", before: side(extra.old_value), after: side(extra.new_value) };
  }
  if (AUDIENCE_EVENTS.has(raw.event_type)) {
    return { valueKind: "name", before: null, after: { name: asText(extra.name) ?? raw.object_name ?? null } };
  }
  const before = scalarSide(extra.old_value);
  const after = scalarSide(extra.new_value);
  return before || after ? { valueKind: "scalar", before, after } : NO_CHANGE;
}

export function normalizeMetaActivity(raw: RawMetaActivity, ctx: NormalizeContext): NormalizedActivity {
  const extra = parseExtraData(raw.extra_data);
  const objectLevel = objectLevelOf(raw);
  const objectExternalId = asText(raw.object_id);
  const parentId = extra ? idOf(extra.campaign_id) : null;
  const change = changeOf(raw, extra);

  return {
    source: "meta",
    accountExternalId: ctx.accountExternalId,
    eventType: raw.event_type,
    translatedTitle: raw.translated_event_type ?? null,
    objectLevel,
    objectExternalId,
    objectName: raw.object_name ?? null,
    campaignExternalId: objectLevel === "campaign" ? objectExternalId : null,
    adSetExternalId: objectLevel === "ad_set" ? objectExternalId : objectLevel === "ad" ? parentId : null,
    occurredAt: metaTimeToIso(raw.event_time),
    actorKind: actorKindOf(raw, ctx),
    actorExternalId: raw.actor_id ?? null,
    actorName: raw.actor_name ?? null,
    appId: raw.application_id ?? null,
    appName: raw.application_name ?? null,
    ...change,
  };
}
