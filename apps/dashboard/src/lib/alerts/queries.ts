import type { AlertsAuth } from "./server";
import type { TriageQuery } from "./schemas";
import { transitionError, triageState, type TriageAction } from "./triage";
import type { AlertAssignee, AlertRow, AlertTriageItem, AlertTriagePage } from "./types";

type Relation<T> = T | T[] | null;

type CampaignEmbed = {
  name: string | null;
  ad_accounts: Relation<{ name: string | null; clients: Relation<{ name: string | null }> }>;
};

type RawAlert = AlertRow & { campaigns?: Relation<CampaignEmbed> };

export const TRIAGE_COLUMNS =
  "id, org_id, rule_id, campaign_id, metric, operator, threshold, observed_value, channel, title, message, status, triggered_at, read_at, severity, assigned_to, acknowledged_at, resolved_at, resolution_note, metadata, campaigns(name, ad_accounts(name, clients(name)))";

export type MutationOutcome =
  | { ok: true; item: AlertTriageItem }
  | { ok: false; status: number; error: string };

function one<T>(relation: Relation<T> | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

export function toTriageItem(raw: RawAlert): AlertTriageItem {
  const { campaigns, ...alert } = raw;
  const campaign = one(campaigns);
  const account = one(campaign?.ad_accounts);
  const meta = alert.metadata ?? null;
  return {
    ...alert,
    threshold: Number(alert.threshold),
    observed_value: Number(alert.observed_value),
    state: triageState(alert),
    campaign_name: meta?.campaign_name ?? campaign?.name ?? null,
    account_name: meta?.ad_account_name ?? account?.name ?? null,
    client_name: meta?.client_name ?? one(account?.clients)?.name ?? null,
  };
}

export async function listTriageAlerts(auth: AlertsAuth, query: TriageQuery): Promise<AlertTriagePage> {
  const from = (query.page - 1) * query.limit;
  let builder = auth.supabase
    .from("alerts")
    .select(TRIAGE_COLUMNS, { count: "exact" })
    .eq("org_id", auth.orgId)
    .order("triggered_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + query.limit - 1);

  if (query.state === "open") builder = builder.is("resolved_at", null).is("acknowledged_at", null);
  if (query.state === "acknowledged") builder = builder.is("resolved_at", null).not("acknowledged_at", "is", null);
  if (query.state === "resolved") builder = builder.not("resolved_at", "is", null);
  if (query.severity !== "all") builder = builder.eq("severity", query.severity);
  if (query.assigned_to === "me") builder = builder.eq("assigned_to", auth.userId);
  else if (query.assigned_to === "unassigned") builder = builder.is("assigned_to", null);
  else if (query.assigned_to !== "all") builder = builder.eq("assigned_to", query.assigned_to);

  const { data, error, count } = await builder;
  if (error) throw new Error(error.message);

  const items = ((data ?? []) as RawAlert[]).map(toTriageItem);
  const total = count ?? items.length;
  return { items, page: query.page, limit: query.limit, total, hasMore: from + items.length < total };
}

export async function listAssignees(auth: AlertsAuth): Promise<AlertAssignee[]> {
  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id, name")
    .eq("org_id", auth.orgId)
    .order("name", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as AlertAssignee[];
}

export async function isOrgMember(auth: AlertsAuth, userId: string): Promise<boolean> {
  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

type Stamps = { id: string; read_at: string | null; acknowledged_at: string | null; resolved_at: string | null };

export async function transitionAlert(
  auth: AlertsAuth,
  id: string,
  action: TriageAction,
  buildPatch: (current: Stamps) => Record<string, unknown>,
): Promise<MutationOutcome> {
  const { data: current, error: loadError } = await auth.supabase
    .from("alerts")
    .select("id, read_at, acknowledged_at, resolved_at")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (loadError) return { ok: false, status: 500, error: "Não deu para carregar o alerta." };
  if (!current) return { ok: false, status: 404, error: "Alerta não encontrado." };

  const stamps = current as Stamps;
  const blocked = transitionError(triageState(stamps), action);
  if (blocked) return { ok: false, status: 409, error: blocked };

  let update = auth.supabase
    .from("alerts")
    .update(buildPatch(stamps))
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .is("resolved_at", null);
  if (action === "acknowledge") update = update.is("acknowledged_at", null);

  const { data, error } = await update.select(TRIAGE_COLUMNS).maybeSingle();
  if (error) return { ok: false, status: 500, error: "Não deu para salvar. Tente de novo." };
  if (!data) return { ok: false, status: 409, error: "O alerta mudou enquanto você agia. Recarregue a lista." };
  return { ok: true, item: toTriageItem(data as RawAlert) };
}

export async function assignAlert(auth: AlertsAuth, id: string, assignee: string | null): Promise<MutationOutcome> {
  if (assignee && !(await isOrgMember(auth, assignee))) {
    return { ok: false, status: 422, error: "Esse destinatário não faz parte da sua organização." };
  }
  const { data, error } = await auth.supabase
    .from("alerts")
    .update({ assigned_to: assignee })
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .select(TRIAGE_COLUMNS)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: "Não deu para atribuir. Tente de novo." };
  if (!data) return { ok: false, status: 404, error: "Alerta não encontrado." };
  return { ok: true, item: toTriageItem(data as RawAlert) };
}
