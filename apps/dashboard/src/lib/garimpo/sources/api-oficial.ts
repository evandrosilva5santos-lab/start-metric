import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/meta/token";
import type { Database } from "@/lib/supabase/types";
import type { Ad, AdSource, SearchParams, SourceResult } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0/ads_archive";
const TIMEOUT_MS = 20_000;
const DEFAULT_LIMIT = 500;

/** A Biblioteca só devolve anúncios comerciais que alcançaram UE/Reino Unido. */
export const COMMERCIAL_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB",
]);

const FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_creative_bodies",
  "ad_creative_link_captions",
  "ad_creative_link_titles",
  "publisher_platforms",
].join(",");

type ArchiveRow = {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_titles?: string[];
};

type ArchiveResponse = {
  data?: ArchiveRow[];
  paging?: { next?: string };
  error?: { code?: number; error_subcode?: number; message?: string };
};

async function orgMetaToken(supabase: SupabaseClient<Database>, orgId: string): Promise<string | null> {
  const { data } = await supabase
    .from("ad_accounts")
    .select("token_encrypted")
    .eq("org_id", orgId)
    .eq("platform", "meta")
    .not("token_encrypted", "is", null)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.token_encrypted) return null;
  try {
    return await decryptToken(data.token_encrypted, supabase);
  } catch {
    return null;
  }
}

function toAd(row: ArchiveRow): Ad | null {
  if (!row.id || !row.page_id) return null;
  const caption = row.ad_creative_link_captions?.find(Boolean) ?? null;
  return {
    adArchiveId: row.id,
    pageId: row.page_id,
    pageName: row.page_name ?? null,
    startedAt: row.ad_delivery_start_time ? new Date(row.ad_delivery_start_time).toISOString() : null,
    isActive: !row.ad_delivery_stop_time,
    // A API não entrega o link de destino, só o domínio exibido.
    link: null,
    displayedDomain: caption ? caption.toLowerCase() : null,
    // ad_snapshot_url carrega o token na query: nunca guardamos.
    mediaUrl: null,
    bodyText: row.ad_creative_bodies?.find(Boolean) ?? null,
    cta: row.ad_creative_link_titles?.find(Boolean) ?? null,
    format: null,
  };
}

export function createApiOficialSource(ctx: { supabase: SupabaseClient<Database>; orgId: string }): AdSource {
  return {
    id: "api_oficial",
    async search(params: SearchParams): Promise<SourceResult> {
      const token = await orgMetaToken(ctx.supabase, ctx.orgId);
      if (!token) {
        return { ads: [], status: "not_configured", message: "Conecte uma conta Meta em Configurações para usar a API oficial." };
      }

      const country = params.country.toUpperCase();
      const notice = COMMERCIAL_COUNTRIES.has(country)
        ? undefined
        : "Fora da UE/Reino Unido a API oficial só devolve anúncios políticos. Para o Brasil, use a fonte Terceiro.";

      const limit = params.limit ?? DEFAULT_LIMIT;
      const query = new URLSearchParams({
        search_terms: params.niche,
        ad_reached_countries: JSON.stringify([country]),
        ad_active_status: "ALL",
        ad_type: "ALL",
        fields: FIELDS,
        limit: "100",
      });
      let next: string | null = `${GRAPH}?${query.toString()}`;
      const ads: Ad[] = [];

      while (next && ads.length < limit) {
        let body: ArchiveResponse;
        try {
          const res = await fetch(next, {
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: "no-store",
          });
          body = (await res.json()) as ArchiveResponse;
        } catch {
          return { ads, status: ads.length ? "blocked" : "error", message: "A Graph API não respondeu a tempo." };
        }
        if (body.error) {
          const code = body.error.code ?? 0;
          if (code === 4 || code === 17 || code === 613 || code === 32) {
            return { ads, status: "blocked", message: "Limite de chamadas da Meta atingido. Tente de novo em 1 hora." };
          }
          if (code === 190) {
            return { ads, status: "error", message: "O token da conta Meta expirou. Reconecte a conta em Configurações." };
          }
          return {
            ads,
            status: "error",
            message:
              code === 10 || code === 2332004
                ? "O app da Meta desta conta não tem acesso à Biblioteca de Anúncios. Confirme a identidade em facebook.com/ID."
                : "A Graph API recusou a consulta.",
          };
        }
        for (const row of body.data ?? []) {
          const ad = toAd(row);
          if (ad) ads.push(ad);
        }
        next = body.paging?.next ?? null;
      }

      return { ads: ads.slice(0, limit), status: "ok", message: notice };
    },
  };
}
