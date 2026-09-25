import "server-only";

import type { Ad, AdSource, SearchParams, SourceResult } from "./types";

const DEFAULT_ACTOR = "curious_coder~facebook-ads-library-scraper";
const TIMEOUT_MS = 280_000;
const DEFAULT_LIMIT = 300;

type Json = Record<string, unknown>;

function pick(obj: Json | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function toIso(value: unknown): string | null {
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value).toISOString();
  if (typeof value === "string" && value) {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) return toIso(asNum);
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  return null;
}

function firstMedia(snapshot: Json | undefined): string | null {
  if (!snapshot) return null;
  const images = pick(snapshot, "images") as Json[] | undefined;
  const videos = pick(snapshot, "videos") as Json[] | undefined;
  const cards = pick(snapshot, "cards") as Json[] | undefined;
  const candidates = [
    ...(Array.isArray(images) ? images.map((i) => pick(i, "resized_image_url", "original_image_url", "resizedImageUrl", "originalImageUrl")) : []),
    ...(Array.isArray(videos) ? videos.map((v) => pick(v, "video_preview_image_url", "videoPreviewImageUrl")) : []),
    ...(Array.isArray(cards) ? cards.map((c) => pick(c, "resized_image_url", "original_image_url", "video_preview_image_url")) : []),
  ];
  return candidates.map(str).find(Boolean) ?? null;
}

export function parseApifyItem(item: Json): Ad | null {
  const snapshot = pick(item, "snapshot") as Json | undefined;
  const adArchiveId = str(pick(item, "ad_archive_id", "adArchiveID", "adArchiveId", "id"));
  const pageId = str(pick(item, "page_id", "pageID", "pageId")) ?? str(pick(snapshot ?? {}, "page_id", "pageId"));
  if (!adArchiveId || !pageId) return null;
  const body = pick(snapshot ?? {}, "body");
  const bodyText = typeof body === "string" ? body : str(pick((body as Json) ?? {}, "text", "markup"));
  const active = pick(item, "is_active", "isActive");
  return {
    adArchiveId,
    pageId,
    pageName: str(pick(item, "page_name", "pageName")) ?? str(pick(snapshot ?? {}, "page_name", "pageName")),
    startedAt: toIso(pick(item, "start_date", "startDate", "start_date_string")),
    isActive: active === undefined ? true : Boolean(active),
    link: str(pick(snapshot ?? {}, "link_url", "linkUrl")),
    displayedDomain: str(pick(snapshot ?? {}, "caption"))?.toLowerCase() ?? null,
    mediaUrl: firstMedia(snapshot),
    bodyText,
    cta: str(pick(snapshot ?? {}, "cta_text", "ctaText")),
    format: str(pick(snapshot ?? {}, "display_format", "displayFormat"))?.toLowerCase() ?? null,
  };
}

function costPerThousand(): number | null {
  const raw = Number(process.env.APIFY_COST_PER_1000);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function createTerceiroSource(): AdSource {
  return {
    id: "terceiro",
    async search(params: SearchParams): Promise<SourceResult> {
      const token = process.env.APIFY_TOKEN?.trim();
      if (!token) {
        return { ads: [], status: "not_configured", message: "Fonte Terceiro não configurada: defina APIFY_TOKEN no servidor." };
      }
      const actor = (process.env.APIFY_ACTOR_ID?.trim() || DEFAULT_ACTOR).replace("/", "~");
      const limit = params.limit ?? DEFAULT_LIMIT;
      const libraryUrl = new URL("https://www.facebook.com/ads/library/");
      libraryUrl.search = new URLSearchParams({
        active_status: "active",
        ad_type: "all",
        country: params.country.toUpperCase(),
        q: params.niche,
        search_type: "keyword_unordered",
        media_type: "all",
      }).toString();

      let res: Response;
      try {
        res = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?format=json&clean=true`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ urls: [{ url: libraryUrl.toString() }], count: limit, scrapeAdDetails: false }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
      } catch {
        return { ads: [], status: "error", message: "A Apify não respondeu a tempo.", costPerThousand: costPerThousand() };
      }

      if (res.status === 401 || res.status === 403) {
        return { ads: [], status: "error", message: "A Apify recusou o APIFY_TOKEN.", costPerThousand: costPerThousand() };
      }
      if (res.status === 402) {
        return { ads: [], status: "error", message: "Sem crédito na Apify para esta varredura.", costPerThousand: costPerThousand() };
      }
      if (!res.ok) {
        return { ads: [], status: "error", message: `A Apify falhou (HTTP ${res.status}).`, costPerThousand: costPerThousand() };
      }

      const items = (await res.json().catch(() => [])) as Json[];
      const ads = (Array.isArray(items) ? items : []).map(parseApifyItem).filter((a): a is Ad => a !== null);
      const blocked = ads.length === 0 && Array.isArray(items) && items.some((i) => pick(i, "error", "errorDescription"));
      return {
        ads: ads.slice(0, limit),
        status: blocked ? "blocked" : "ok",
        message: blocked ? "O scraper da Apify foi bloqueado pela Meta nesta rodada." : undefined,
        costPerThousand: costPerThousand(),
      };
    },
  };
}
