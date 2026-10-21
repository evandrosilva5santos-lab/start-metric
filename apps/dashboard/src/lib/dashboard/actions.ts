import "server-only";

import { cache } from "react";
import { filtersKey, getDashboardContext, resolveDashboardAccess } from "./queries";
import { timed } from "./rollup";
import { summarizeActionRows, type ActionRow, type ActionTotals } from "./funnel";
import type { DashboardFilters } from "./types";

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const MAX_IN_FILTER = 100;

const EMPTY: ActionTotals = { coverage: "none", total: {}, byDay: {}, byCampaign: {} };

type RawActionRow = { date: string; campaign_id: string; actions: unknown };

function asActionRow(row: RawActionRow): ActionRow {
  const actions =
    row.actions && typeof row.actions === "object" && !Array.isArray(row.actions)
      ? (row.actions as Record<string, unknown>)
      : null;
  return { date: row.date, campaign_id: row.campaign_id, actions };
}

const loadDashboardActions = cache(async (key: string): Promise<ActionTotals> => {
  const filters = JSON.parse(key) as DashboardFilters;
  const [context, { supabase }] = await Promise.all([
    getDashboardContext(filters),
    resolveDashboardAccess(),
  ]);
  const campaignIds = context.campaigns.map((campaign) => campaign.id);
  if (campaignIds.length === 0) return EMPTY;

  const known = new Set(campaignIds);
  const rows: ActionRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabase
      .from("daily_metrics")
      .select("date, campaign_id, actions")
      .eq("org_id", context.orgId)
      .gte("date", context.range.from)
      .lte("date", context.range.to);
    if (campaignIds.length <= MAX_IN_FILTER) query = query.in("campaign_id", campaignIds);

    const { data, error } = await timed(`actions page ${page}`, () =>
      query
        .order("date", { ascending: true })
        .order("campaign_id", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
    );
    if (error) {
      console.warn(`[dashboard] Ações da Meta indisponíveis no banco: ${error.message}`);
      return EMPTY;
    }
    const batch = (data ?? []) as RawActionRow[];
    for (const row of batch) {
      if (known.has(row.campaign_id)) rows.push(asActionRow(row));
    }
    if (batch.length < PAGE_SIZE) return summarizeActionRows(rows);
  }
  return { ...summarizeActionRows(rows), coverage: "partial" };
});

export function getDashboardActions(filters: DashboardFilters = {}): Promise<ActionTotals> {
  return loadDashboardActions(filtersKey(filters));
}
