import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ParsedMetric } from "./client";

type DbClient = SupabaseClient<Database>;
export type DailyMetricInsert = Database["public"]["Tables"]["daily_metrics"]["Insert"];

const ON_CONFLICT = "campaign_id,date";
const MISSING_COLUMN_CODE = "PGRST204";

export function toDailyMetricRow(metric: ParsedMetric, campaignId: string, orgId: string): DailyMetricInsert {
  return {
    campaign_id: campaignId,
    org_id: orgId,
    date: metric.date,
    spend: metric.spend,
    impressions: metric.impressions,
    clicks: metric.clicks,
    conversions: metric.conversions,
    revenue_attributed: metric.revenue_attributed,
    roas: metric.roas,
    cpa: metric.cpa,
    actions: metric.actions,
    action_values: metric.action_values,
  };
}

function isMissingActionColumns(error: PostgrestError): boolean {
  return error.code === MISSING_COLUMN_CODE && /'action(s|_values)'/.test(error.message);
}

function withoutActionColumns(row: DailyMetricInsert): DailyMetricInsert {
  const { actions: _actions, action_values: _actionValues, ...legacy } = row;
  return legacy;
}

export async function upsertDailyMetrics(
  supabase: DbClient,
  rows: readonly DailyMetricInsert[],
): Promise<{ error: PostgrestError | null; legacy: boolean }> {
  if (rows.length === 0) return { error: null, legacy: false };

  const { error } = await supabase.from("daily_metrics").upsert([...rows], { onConflict: ON_CONFLICT });
  if (!error || !isMissingActionColumns(error)) return { error, legacy: false };

  const retry = await supabase
    .from("daily_metrics")
    .upsert(rows.map(withoutActionColumns), { onConflict: ON_CONFLICT });
  return { error: retry.error, legacy: true };
}
