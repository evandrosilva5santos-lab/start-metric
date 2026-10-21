import type { AlertsAuth } from "./server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listOperationalAccounts } from "@/lib/accounts/operational";
import { defaultOperator } from "./evaluation";
import type { RuleCreateInput, RuleUpdateInput } from "./schemas";

export const RULE_COLUMNS =
  "id, org_id, campaign_id, client_id, ad_account_id, metric, operator, threshold, channel, template_body, active, created_at, updated_at";

export type RuleOutcome = { ok: true; rule: unknown } | { ok: false; status: number; error: string };

const FOREIGN_KEY_VIOLATION = "23503";

function normalizeTemplate(body: string | null | undefined): string | null | undefined {
  if (body === undefined) return undefined;
  return body && body.trim() ? body : null;
}

type ScopeInput = Pick<RuleCreateInput, "campaign_id" | "client_id" | "ad_account_id">;

async function scopeError(auth: AlertsAuth, input: ScopeInput): Promise<string | null> {
  const db = auth.supabase as SupabaseClient<Database>;
  const inventory = await listOperationalAccounts(db, auth.orgId);
  const accounts = new Map(inventory.accounts.map((account) => [account.id, account]));

  if (input.client_id && !inventory.accounts.some((account) => account.client_id === input.client_id)) {
    return "Cliente sem conta operacional autorizada nesta organização.";
  }

  if (input.ad_account_id) {
    const account = accounts.get(input.ad_account_id);
    if (!account || (input.client_id && account.client_id !== input.client_id)) {
      return "Conta não autorizada para o cliente informado.";
    }
  }

  if (input.campaign_id) {
    const { data, error } = await db
      .from("campaigns")
      .select("ad_account_id")
      .eq("id", input.campaign_id)
      .eq("org_id", auth.orgId)
      .maybeSingle();
    if (error) throw new Error(`Falha ao validar campanha: ${error.message}`);
    const account = data ? accounts.get(data.ad_account_id) : undefined;
    if (!account || (input.client_id && account.client_id !== input.client_id)) {
      return "Campanha não pertence a uma conta operacional do cliente informado.";
    }
  }

  return null;
}

function failure(error: { code?: string; message: string }): RuleOutcome {
  if (error.code === FOREIGN_KEY_VIOLATION) {
    return { ok: false, status: 422, error: "Cliente ou conta não pertence à sua organização." };
  }
  return { ok: false, status: 500, error: "Não deu para salvar a regra." };
}

export async function createRule(auth: AlertsAuth, input: RuleCreateInput): Promise<RuleOutcome> {
  const invalidScope = await scopeError(auth, input);
  if (invalidScope) return { ok: false, status: 422, error: invalidScope };
  const { data, error } = await auth.supabase
    .from("notification_rules")
    .insert({
      org_id: auth.orgId,
      metric: input.metric,
      operator: input.operator ?? defaultOperator(input.metric),
      threshold: input.threshold,
      campaign_id: input.campaign_id ?? null,
      client_id: input.client_id ?? null,
      ad_account_id: input.ad_account_id ?? null,
      template_body: normalizeTemplate(input.template_body) ?? null,
      channel: "web_push",
      active: input.active ?? true,
      created_by: auth.userId,
    })
    .select(RULE_COLUMNS)
    .single();
  if (error) return failure(error);
  return { ok: true, rule: data };
}

export async function updateRule(auth: AlertsAuth, id: string, input: RuleUpdateInput): Promise<RuleOutcome> {
  const { data: current, error: currentError } = await auth.supabase
    .from("notification_rules")
    .select("campaign_id, client_id, ad_account_id")
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .maybeSingle();
  if (currentError) return failure(currentError);
  if (!current) return { ok: false, status: 404, error: "Regra não encontrada." };

  const invalidScope = await scopeError(auth, {
    campaign_id: input.campaign_id === undefined ? (current.campaign_id as string | null) : input.campaign_id,
    client_id: input.client_id === undefined ? (current.client_id as string | null) : input.client_id,
    ad_account_id:
      input.ad_account_id === undefined ? (current.ad_account_id as string | null) : input.ad_account_id,
  });
  if (invalidScope) return { ok: false, status: 422, error: invalidScope };
  const template = normalizeTemplate(input.template_body);
  const patch = { ...input, ...(template === undefined ? {} : { template_body: template }) };
  const { data, error } = await auth.supabase
    .from("notification_rules")
    .update(patch)
    .eq("id", id)
    .eq("org_id", auth.orgId)
    .select(RULE_COLUMNS)
    .maybeSingle();
  if (error) return failure(error);
  if (!data) return { ok: false, status: 404, error: "Regra não encontrada." };
  return { ok: true, rule: data };
}
