// Tipos da Central de Histórico. Módulo puro (sem "@/"), usado também pelos testes em scripts/.

export type ObjectLevel =
  | "account"
  | "campaign"
  | "ad_set"
  | "ad"
  | "audience"
  | "creative_library"
  | "tracking"
  | "client"
  | "report"
  | "integration"
  | "other";

export type ActorKind = "person" | "platform" | "integration" | "system_user" | "unknown";

export type ActivityCategory =
  | "budget"
  | "status"
  | "creative"
  | "targeting"
  | "structure"
  | "bidding"
  | "tracking"
  | "billing"
  | "analysis"
  | "meeting"
  | "optimization"
  | "task"
  | "note"
  | "connection"
  | "report"
  | "platform"
  | "other";

export type BudgetValue = { amountMinor: number | null; currency: string | null; period: "daily" | "lifetime" | null };
export type StatusValue = { statusCode: number | null; label: string | null };
export type TargetingItem = { label: string; values: string[] };
export type TargetingValue = { items: TargetingItem[] };
export type NameValue = { name: string | null };
export type ScalarValue = { value: string | number | boolean | null };
export type ScheduleValue = { start: string | null; stop: string | null };

export type ActivityValue = BudgetValue | StatusValue | TargetingValue | NameValue | ScalarValue | ScheduleValue;

export type ValueKind = "budget" | "status" | "targeting" | "name" | "scalar" | "schedule" | "none";

/** Evento cru de act_{id}/activities, já com ids grandes preservados como texto. */
export type RawMetaActivity = {
  event_type: string;
  translated_event_type?: string;
  event_time: string;
  actor_id?: string;
  actor_name?: string;
  application_id?: string;
  application_name?: string;
  object_id?: string | number;
  object_name?: string;
  object_type?: string;
  extra_data?: string;
};

export type NormalizedActivity = {
  source: "meta";
  accountExternalId: string;
  eventType: string;
  translatedTitle: string | null;
  objectLevel: ObjectLevel;
  objectExternalId: string | null;
  objectName: string | null;
  campaignExternalId: string | null;
  adSetExternalId: string | null;
  occurredAt: string;
  actorKind: ActorKind;
  actorExternalId: string | null;
  actorName: string | null;
  appId: string | null;
  appName: string | null;
  valueKind: ValueKind;
  before: ActivityValue | null;
  after: ActivityValue | null;
};

export type ActivityClassification = { category: ActivityCategory; action: string; countsAsWork: boolean };

export type ActivityDescription = { title: string; detail: string };
