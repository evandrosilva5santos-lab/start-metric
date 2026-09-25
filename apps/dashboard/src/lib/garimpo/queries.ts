import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { todayKey } from "./ingest";
import { computeSignals, DEFAULT_CUT, passesCut, type Cut, type OfferSignals } from "./score";
import type { GarimpoOverview, OfferCardView, OfferDetailView, RunStatus, RunView } from "./view-types";

type Db = SupabaseClient<Database>;
type RunRow = Database["public"]["Tables"]["garimpo_runs"]["Row"];

const SPARK_DAYS = 30;
const MAX_OFFERS = 300;

function toRun(row: RunRow | null | undefined): RunView | null {
  if (!row) return null;
  return {
    id: row.id,
    source: row.source,
    niche: row.niche,
    country: row.country,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    adsRead: row.ads_read,
    domainsFound: row.domains_found,
    status: row.status as RunStatus,
    errorText: row.error_text,
    costPerThousand: row.cost_per_thousand,
  };
}

function signalsFrom(parts: Json | null): OfferSignals | null {
  if (!parts || typeof parts !== "object" || Array.isArray(parts)) return null;
  const signals = (parts as Record<string, unknown>).signals;
  if (!signals || typeof signals !== "object") return null;
  return signals as OfferSignals;
}

function startOfTodayIso(): string {
  // Meia-noite de São Paulo (UTC-3, sem horário de verão desde 2019).
  return new Date(`${todayKey()}T00:00:00-03:00`).toISOString();
}

function daysAgoKey(days: number): string {
  return todayKey(new Date(Date.now() - days * 86_400_000));
}

async function loadRuns(supabase: Db, orgId: string) {
  const [latest, lastGood] = await Promise.all([
    supabase.from("garimpo_runs").select("*").eq("org_id", orgId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("garimpo_runs")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "ok")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return { latestRun: toRun(latest.data), lastGoodRun: toRun(lastGood.data) };
}

export async function loadCut(supabase: Db, orgId: string): Promise<Cut> {
  const { data } = await supabase.from("garimpo_cuts").select("*").eq("org_id", orgId).maybeSingle();
  if (!data) return DEFAULT_CUT;
  return { minAds: data.min_ads, minDays: data.min_days, minPages: data.min_pages, formats: data.formats ?? [] };
}

export async function getGarimpoOverview(supabase: Db, orgId: string): Promise<GarimpoOverview> {
  const [{ latestRun, lastGoodRun }, cut, offersRes] = await Promise.all([
    loadRuns(supabase, orgId),
    loadCut(supabase, orgId),
    supabase
      .from("garimpo_offers")
      .select("id, domain, status, watch, score, score_parts, first_seen_at, last_seen_at")
      .eq("org_id", orgId)
      .order("score", { ascending: false, nullsFirst: false })
      .limit(MAX_OFFERS),
  ]);

  const emptyKpis = { newToday: null, passedCut: null, repeatedCreative: null, adsRead: latestRun?.adsRead ?? null };
  if (offersRes.error) {
    return { offers: [], cut, latestRun, lastGoodRun, kpis: emptyKpis, loadError: "Não foi possível ler as ofertas salvas." };
  }

  const rows = offersRes.data ?? [];
  const ids = rows.map((r) => r.id);
  const [divergentRes, dailyRes, adsRes] = ids.length
    ? await Promise.all([
        supabase.from("garimpo_offer_domains").select("offer_id").eq("org_id", orgId).eq("divergent", true).in("offer_id", ids),
        supabase
          .from("garimpo_offer_daily")
          .select("offer_id, day, active_ads")
          .eq("org_id", orgId)
          .in("offer_id", ids)
          .gte("day", daysAgoKey(SPARK_DAYS))
          .order("day", { ascending: true }),
        supabase
          .from("garimpo_ads")
          .select("offer_id, media_url, creative_hash, hash_kind")
          .eq("org_id", orgId)
          .in("offer_id", ids)
          .order("started_at", { ascending: false, nullsFirst: false })
          .limit(6000),
      ])
    : [null, null, null];

  const divergent = new Set((divergentRes?.data ?? []).map((r) => r.offer_id));
  const spark = new Map<string, number[]>();
  for (const row of dailyRes?.data ?? []) {
    const list = spark.get(row.offer_id) ?? [];
    list.push(row.active_ads);
    spark.set(row.offer_id, list);
  }
  const thumbs = new Map<string, string[]>();
  const seenHash = new Map<string, Set<string>>();
  const hasPixelHash = new Set<string>();
  for (const ad of adsRes?.data ?? []) {
    if (ad.hash_kind === "phash") hasPixelHash.add(ad.offer_id);
    if (!ad.media_url) continue;
    const list = thumbs.get(ad.offer_id) ?? [];
    const hashes = seenHash.get(ad.offer_id) ?? new Set<string>();
    const key = ad.creative_hash ?? ad.media_url;
    if (list.length >= 4 || hashes.has(key)) continue;
    hashes.add(key);
    list.push(ad.media_url);
    thumbs.set(ad.offer_id, list);
    seenHash.set(ad.offer_id, hashes);
  }

  const offers: OfferCardView[] = rows.map((r) => {
    const signals = signalsFrom(r.score_parts);
    return {
      id: r.id,
      domain: r.domain,
      status: r.status,
      watch: r.watch,
      score: r.score,
      signals,
      divergent: divergent.has(r.id),
      passesCut: signals ? passesCut(signals, cut) : false,
      weakHash: !hasPixelHash.has(r.id),
      spark: spark.get(r.id) ?? [],
      thumbs: thumbs.get(r.id) ?? [],
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
    };
  });

  const todayStart = startOfTodayIso();
  return {
    offers,
    cut,
    latestRun,
    lastGoodRun,
    kpis: {
      newToday: offers.filter((o) => o.firstSeenAt >= todayStart).length,
      passedCut: offers.filter((o) => o.passesCut).length,
      repeatedCreative: offers.filter((o) => (o.signals?.repeatedCreatives ?? 0) > 0).length,
      adsRead: latestRun?.adsRead ?? null,
    },
    loadError: null,
  };
}

export async function getOfferDetail(supabase: Db, orgId: string, domain: string): Promise<OfferDetailView | null> {
  const { data: offer } = await supabase
    .from("garimpo_offers")
    .select("id, domain, status, watch, score, first_seen_at, last_seen_at")
    .eq("org_id", orgId)
    .eq("domain", domain)
    .maybeSingle();
  if (!offer) return null;

  const [pagesRes, adsRes, chainsRes, dailyRes, runs] = await Promise.all([
    supabase.from("garimpo_pages").select("id, page_id_meta, page_name, first_seen_at").eq("org_id", orgId).eq("offer_id", offer.id).order("first_seen_at"),
    supabase
      .from("garimpo_ads")
      .select("page_id, started_at, is_active, creative_hash, hash_kind, media_url, body_text, format")
      .eq("org_id", orgId)
      .eq("offer_id", offer.id)
      .limit(5000),
    supabase
      .from("garimpo_offer_domains")
      .select("raw_link, displayed_domain, redirect_chain, resolved_domain, divergent, resolve_error, checked_at")
      .eq("org_id", orgId)
      .eq("offer_id", offer.id)
      .order("divergent", { ascending: false })
      .limit(50),
    supabase.from("garimpo_offer_daily").select("day, active_ads, pages").eq("org_id", orgId).eq("offer_id", offer.id).order("day"),
    loadRuns(supabase, orgId),
  ]);

  const ads = adsRes.data ?? [];
  const signals = computeSignals(
    ads.map((a) => ({ pageKey: a.page_id, startedAt: a.started_at, isActive: a.is_active, creativeHash: a.creative_hash, format: a.format })),
  );

  const perPage = new Map<string, { active: number; total: number }>();
  for (const ad of ads) {
    const agg = perPage.get(ad.page_id) ?? { active: 0, total: 0 };
    agg.total++;
    if (ad.is_active) agg.active++;
    perPage.set(ad.page_id, agg);
  }
  const pages = (pagesRes.data ?? []).map((p) => ({
    id: p.id,
    pageIdMeta: p.page_id_meta,
    pageName: p.page_name,
    firstSeenAt: p.first_seen_at,
    activeAds: perPage.get(p.id)?.active ?? 0,
    totalAds: perPage.get(p.id)?.total ?? 0,
  }));

  const newPageDays = [...new Set(pages.map((p) => todayKey(new Date(p.firstSeenAt))))].sort();
  const dailyMap = new Map<string, { day: string; activeAds: number | null; pages: number | null }>();
  for (const d of dailyRes.data ?? []) dailyMap.set(d.day, { day: d.day, activeAds: d.active_ads, pages: d.pages });
  for (const day of newPageDays) if (!dailyMap.has(day)) dailyMap.set(day, { day, activeAds: null, pages: null });
  const daily = [...dailyMap.values()].sort((a, b) => a.day.localeCompare(b.day));

  const groups = new Map<string, OfferDetailView["creatives"][number] & { pageSet: Set<string> }>();
  for (const [i, ad] of ads.entries()) {
    const key = ad.creative_hash ?? `ad-${i}`;
    const group = groups.get(key) ?? {
      key,
      mediaUrl: ad.media_url,
      bodyText: ad.body_text,
      pageCount: 0,
      adCount: 0,
      kind: (ad.hash_kind as "phash" | "fingerprint" | null) ?? null,
      format: ad.format,
      pageSet: new Set<string>(),
    };
    group.adCount++;
    group.pageSet.add(ad.page_id);
    group.mediaUrl = group.mediaUrl ?? ad.media_url;
    groups.set(key, group);
  }
  const creatives = [...groups.values()]
    .map(({ pageSet, ...g }) => ({ ...g, pageCount: pageSet.size }))
    .sort((a, b) => b.pageCount - a.pageCount || b.adCount - a.adCount)
    .slice(0, 48);

  const chains = (chainsRes.data ?? []).map((c) => ({
    rawLink: c.raw_link,
    displayedDomain: c.displayed_domain,
    chain: c.redirect_chain ?? [],
    resolvedDomain: c.resolved_domain,
    divergent: c.divergent,
    error: c.resolve_error,
    checkedAt: c.checked_at,
  }));

  return {
    offer: {
      id: offer.id,
      domain: offer.domain,
      status: offer.status,
      watch: offer.watch,
      score: offer.score,
      firstSeenAt: offer.first_seen_at,
      lastSeenAt: offer.last_seen_at,
    },
    signals,
    divergent: chains.some((c) => c.divergent),
    pages,
    daily,
    newPageDays,
    chains,
    creatives,
    ...runs,
  };
}
