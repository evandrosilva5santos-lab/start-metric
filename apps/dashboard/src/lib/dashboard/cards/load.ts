import "server-only";

import { cache } from "react";
import { filtersKey, getDashboardContext, resolveDashboardAccess, type DashboardContext } from "../queries";
import { previousRange } from "../overview-range";
import { timed } from "../rollup";
import type { DashboardFilters } from "../types";
import type { DailyMetricRow } from "../../reports/engine/metrics";
import { computeCardValues, summarizeRows, type ClientCardsModel } from "./layout";
import { defaultLayoutFor, defaultSourceLabel, detectObjective, type ObjectiveKind } from "./objective";
import { findActiveClient, readClientLayout, type LayoutDb } from "./store";

export type { ClientCardsModel } from "./layout";

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const MAX_IN_FILTER = 100;
const COLUMNS = "date, campaign_id, spend, impressions, clicks, conversions, revenue_attributed, actions, action_values";

type MetricRow = DailyMetricRow & { campaign_id: string };
type Range = { from: string; to: string };
type Fetched = { rows: MetricRow[]; truncated: boolean };

function asObject(value: unknown): Record<string, number | string | null> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, number | string | null>) : null;
}

async function fetchRows(db: LayoutDb, context: DashboardContext, range: Range): Promise<Fetched> {
  const campaignIds = context.campaigns.map((campaign) => campaign.id);
  if (campaignIds.length === 0) return { rows: [], truncated: false };
  const known = new Set(campaignIds);
  const rows: MetricRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = db
      .from("daily_metrics")
      .select(COLUMNS)
      .eq("org_id", context.orgId)
      .gte("date", range.from)
      .lte("date", range.to);
    if (campaignIds.length <= MAX_IN_FILTER) query = query.in("campaign_id", campaignIds);
    const { data, error } = await timed(`client cards ${range.from} page ${page}`, () =>
      query
        .order("date", { ascending: true })
        .order("campaign_id", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
    );
    if (error) throw new Error(`CLIENT_CARDS_ERROR:${error.message}`);
    const batch = data ?? [];
    for (const row of batch) {
      if (!known.has(row.campaign_id)) continue;
      rows.push({ ...row, actions: asObject(row.actions), action_values: asObject(row.action_values) });
    }
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

function spendByCampaign(rows: readonly MetricRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const spend = Number(row.spend ?? 0);
    if (Number.isFinite(spend)) totals.set(row.campaign_id, (totals.get(row.campaign_id) ?? 0) + spend);
  }
  return totals;
}

function objectiveFor(context: DashboardContext, rows: readonly MetricRow[]): ObjectiveKind | null {
  const spend = spendByCampaign(rows);
  return detectObjective(
    context.campaigns.map((campaign) => ({ objective: campaign.objective, spend: spend.get(campaign.id) ?? null })),
  );
}

const loadClientCards = cache(async (key: string): Promise<ClientCardsModel | null> => {
  const filters = JSON.parse(key) as DashboardFilters;
  const [context, { supabase }] = await Promise.all([getDashboardContext(filters), resolveDashboardAccess()]);
  const clientId = context.filters.clientId;
  if (!clientId) return null;

  const [client, layout, current, previous] = await Promise.all([
    findActiveClient(supabase, context.orgId, clientId),
    readClientLayout(supabase, context.orgId, clientId),
    fetchRows(supabase, context, context.range),
    fetchRows(supabase, context, previousRange(context.range)),
  ]);
  if (!client) return null;

  const objective = objectiveFor(context, [...current.rows, ...previous.rows]);
  const defaultCards = defaultLayoutFor(objective);
  const activeCards = layout.cards ?? defaultCards;
  return {
    clientId,
    clientName: client.name,
    source: layout.cards ? "saved" : "default",
    objective,
    defaultLabel: defaultSourceLabel(objective),
    defaultCards,
    activeCards,
    cards: computeCardValues(activeCards, summarizeRows(current.rows), summarizeRows(previous.rows)),
    layoutAvailable: layout.available,
    truncated: current.truncated || previous.truncated,
  };
});

export function getClientCards(filters: DashboardFilters): Promise<ClientCardsModel | null> {
  return loadClientCards(filtersKey(filters));
}
