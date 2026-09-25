import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { creativeHashFor, safeMediaUrl } from "./creative-hash";
import { domainOfLink } from "./domain";
import { resolveRedirects, type RedirectResult } from "./redirect";
import { computeSignals, scoreOffer, scoreParts } from "./score";
import { getSource } from "./sources";
import type { Ad, SourceId, SourceResult } from "./sources/types";

type Db = SupabaseClient<Database>;

const MAX_LINKS_PER_RUN = 150;
const RESOLVE_CONCURRENCY = 4;
const CHUNK = 400;

export type ScanInput = {
  orgId: string;
  source: SourceId;
  niche: string;
  country: string;
  pageIds?: string[];
};

export type ScanSummary = {
  runId: string | null;
  status: SourceResult["status"];
  message: string | null;
  adsRead: number;
  domainsFound: number;
};

export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function linkOf(ad: Ad): string | null {
  if (ad.link) return ad.link;
  if (ad.displayedDomain) return `https://${ad.displayedDomain.replace(/^https?:\/\//, "")}`;
  return null;
}

export async function runScan(supabase: Db, input: ScanInput): Promise<ScanSummary> {
  const niche = input.niche.trim().slice(0, 120);
  const country = input.country.trim().toUpperCase().slice(0, 2);
  const { data: run, error: runError } = await supabase
    .from("garimpo_runs")
    .insert({ org_id: input.orgId, niche, country, source: input.source, status: "running" })
    .select("id")
    .single();
  if (runError || !run) {
    return { runId: null, status: "error", message: "Não foi possível registrar a varredura.", adsRead: 0, domainsFound: 0 };
  }

  let outcome: SourceResult;
  try {
    const source = getSource(input.source, { supabase, orgId: input.orgId });
    outcome = await source.search({ niche, country, pageIds: input.pageIds });
  } catch (e) {
    outcome = { ads: [], status: "error", message: e instanceof Error ? e.message.slice(0, 200) : "Falha na fonte." };
  }

  let domainsFound = 0;
  let persistError: string | null = null;
  if (outcome.ads.length > 0) {
    try {
      domainsFound = await persistAds(supabase, input.orgId, niche, country, outcome);
    } catch (e) {
      persistError = e instanceof Error ? e.message.slice(0, 200) : "Falha ao gravar.";
    }
  }

  if (!persistError && outcome.status === "ok" && outcome.completedPageIds?.length) {
    try {
      await deactivateMissing(supabase, input.orgId, outcome.completedPageIds, new Set(outcome.ads.map((a) => a.adArchiveId)));
    } catch (e) {
      persistError = e instanceof Error ? e.message.slice(0, 200) : "Falha ao atualizar anúncios parados.";
    }
  }

  const status = persistError ? "error" : outcome.status;
  const message = persistError ?? outcome.message ?? null;
  await supabase
    .from("garimpo_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      ads_read: outcome.status === "not_configured" || outcome.status === "unavailable" ? null : outcome.ads.length,
      domains_found: outcome.ads.length > 0 ? domainsFound : outcome.status === "ok" ? 0 : null,
      error_text: message,
      cost_per_thousand: outcome.costPerThousand ?? null,
    })
    .eq("id", run.id);

  return { runId: run.id, status, message, adsRead: outcome.ads.length, domainsFound };
}

async function persistAds(supabase: Db, orgId: string, niche: string, country: string, outcome: SourceResult): Promise<number> {
  const now = new Date().toISOString();
  const ads = outcome.ads;

  const uniqueLinks = [...new Set(ads.map(linkOf).filter((l): l is string => !!l))].slice(0, MAX_LINKS_PER_RUN);
  const displayedByLink = new Map<string, string | null>();
  for (const ad of ads) {
    const link = linkOf(ad);
    if (link && !displayedByLink.has(link)) displayedByLink.set(link, ad.displayedDomain);
  }
  const resolved = new Map<string, RedirectResult>();
  const results = await mapLimit(uniqueLinks, RESOLVE_CONCURRENCY, (link) => resolveRedirects(link, displayedByLink.get(link) ?? null));
  uniqueLinks.forEach((link, i) => resolved.set(link, results[i]));

  const domainOfAd = (ad: Ad): string | null => {
    const link = linkOf(ad);
    if (!link) return null;
    return resolved.get(link)?.resolvedDomain ?? domainOfLink(link);
  };

  const byDomain = new Map<string, Ad[]>();
  for (const ad of ads) {
    const domain = domainOfAd(ad);
    if (!domain) continue;
    const list = byDomain.get(domain) ?? [];
    list.push(ad);
    byDomain.set(domain, list);
  }
  if (byDomain.size === 0) return 0;

  const offerIdByDomain = new Map<string, string>();
  for (const part of chunks([...byDomain.keys()])) {
    const { data, error } = await supabase
      .from("garimpo_offers")
      .upsert(
        part.map((domain) => ({ org_id: orgId, domain, last_seen_at: now, niche: niche || null, country: country || null })),
        { onConflict: "org_id,domain" },
      )
      .select("id, domain");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) offerIdByDomain.set(row.domain, row.id);
  }

  const pageRows = new Map<string, { org_id: string; offer_id: string; page_id_meta: string; page_name: string | null }>();
  for (const [domain, list] of byDomain) {
    const offerId = offerIdByDomain.get(domain);
    if (!offerId) continue;
    for (const ad of list) {
      pageRows.set(`${offerId}:${ad.pageId}`, { org_id: orgId, offer_id: offerId, page_id_meta: ad.pageId, page_name: ad.pageName });
    }
  }
  const pageUuid = new Map<string, string>();
  for (const part of chunks([...pageRows.values()])) {
    const { data, error } = await supabase
      .from("garimpo_pages")
      .upsert(part, { onConflict: "org_id,offer_id,page_id_meta" })
      .select("id, offer_id, page_id_meta");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) pageUuid.set(`${row.offer_id}:${row.page_id_meta}`, row.id);
  }

  const adRows: Database["public"]["Tables"]["garimpo_ads"]["Insert"][] = [];
  const seenArchive = new Set<string>();
  for (const [domain, list] of byDomain) {
    const offerId = offerIdByDomain.get(domain);
    if (!offerId) continue;
    for (const ad of list) {
      const pageId = pageUuid.get(`${offerId}:${ad.pageId}`);
      if (!pageId || seenArchive.has(ad.adArchiveId)) continue;
      seenArchive.add(ad.adArchiveId);
      const hash = creativeHashFor(ad);
      adRows.push({
        org_id: orgId,
        page_id: pageId,
        offer_id: offerId,
        ad_archive_id: ad.adArchiveId,
        started_at: ad.startedAt,
        is_active: ad.isActive,
        creative_hash: hash?.hash ?? null,
        hash_kind: hash?.kind ?? null,
        media_url: safeMediaUrl(ad.mediaUrl),
        body_text: ad.bodyText?.slice(0, 2000) ?? null,
        cta: ad.cta?.slice(0, 80) ?? null,
        format: ad.format,
        captured_at: now,
      });
    }
  }
  for (const part of chunks(adRows)) {
    const { error } = await supabase.from("garimpo_ads").upsert(part, { onConflict: "org_id,ad_archive_id" });
    if (error) throw new Error(error.message);
  }

  const domainRows: Database["public"]["Tables"]["garimpo_offer_domains"]["Insert"][] = [];
  for (const [domain, list] of byDomain) {
    const offerId = offerIdByDomain.get(domain);
    if (!offerId) continue;
    const links = new Set(list.map(linkOf).filter((l): l is string => !!l));
    for (const link of links) {
      const r = resolved.get(link);
      domainRows.push({
        org_id: orgId,
        offer_id: offerId,
        raw_link: link.slice(0, 2000),
        displayed_domain: displayedByLink.get(link) ?? null,
        redirect_chain: r?.chain ?? [],
        resolved_domain: r?.resolvedDomain ?? domain,
        divergent: r?.divergent ?? false,
        resolve_error: r ? r.error : "não verificado (limite por varredura)",
        checked_at: now,
      });
    }
  }
  for (const part of chunks(domainRows)) {
    const { error } = await supabase.from("garimpo_offer_domains").upsert(part, { onConflict: "offer_id,raw_link" });
    if (error) throw new Error(error.message);
  }

  await refreshOffers(supabase, orgId, [...offerIdByDomain.values()]);
  return byDomain.size;
}

/** Página lida até o fim: o anúncio que não apareceu parou de rodar. */
async function deactivateMissing(supabase: Db, orgId: string, pageIdsMeta: string[], seen: Set<string>): Promise<void> {
  const { data: pages, error } = await supabase
    .from("garimpo_pages")
    .select("id, offer_id")
    .eq("org_id", orgId)
    .in("page_id_meta", pageIdsMeta);
  if (error) throw new Error(error.message);
  if (!pages?.length) return;
  const { data: active, error: activeError } = await supabase
    .from("garimpo_ads")
    .select("id, ad_archive_id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .in("page_id", pages.map((p) => p.id));
  if (activeError) throw new Error(activeError.message);
  const stopped = (active ?? []).filter((a) => !seen.has(a.ad_archive_id)).map((a) => a.id);
  for (const part of chunks(stopped)) {
    const { error: updError } = await supabase.from("garimpo_ads").update({ is_active: false }).eq("org_id", orgId).in("id", part);
    if (updError) throw new Error(updError.message);
  }
  await refreshOffers(supabase, orgId, [...new Set(pages.map((p) => p.offer_id))]);
}

/** Recalcula sinais, score e o ponto do dia na curva. */
export async function refreshOffers(supabase: Db, orgId: string, offerIds: string[]): Promise<void> {
  const day = todayKey();
  const nowDate = new Date();
  for (const part of chunks(offerIds, 50)) {
    const { data: rows, error } = await supabase
      .from("garimpo_ads")
      .select("offer_id, page_id, started_at, is_active, creative_hash, format")
      .eq("org_id", orgId)
      .in("offer_id", part)
      .limit(20_000);
    if (error) throw new Error(error.message);
    const byOffer = new Map<string, NonNullable<typeof rows>>();
    for (const row of rows ?? []) {
      const list = byOffer.get(row.offer_id) ?? [];
      list.push(row);
      byOffer.set(row.offer_id, list);
    }
    const daily: Database["public"]["Tables"]["garimpo_offer_daily"]["Insert"][] = [];
    for (const offerId of part) {
      const list = byOffer.get(offerId) ?? [];
      const signals = computeSignals(
        list.map((r) => ({ pageKey: r.page_id, startedAt: r.started_at, isActive: r.is_active, creativeHash: r.creative_hash, format: r.format })),
        nowDate,
      );
      const score = scoreOffer(signals);
      await supabase
        .from("garimpo_offers")
        .update({
          score,
          score_parts: { parts: scoreParts(signals), signals } as unknown as Json,
          updated_at: nowDate.toISOString(),
        })
        .eq("id", offerId)
        .eq("org_id", orgId);
      const activePages = new Set(list.filter((r) => r.is_active).map((r) => r.page_id));
      daily.push({ org_id: orgId, offer_id: offerId, day, active_ads: signals.activeAds, pages: activePages.size });
    }
    if (daily.length) {
      const { error: dailyError } = await supabase.from("garimpo_offer_daily").upsert(daily, { onConflict: "offer_id,day" });
      if (dailyError) throw new Error(dailyError.message);
    }
  }
}
