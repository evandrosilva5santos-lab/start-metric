import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { runScan, type ScanSummary } from "./ingest";

/** Revisita as páginas das ofertas vigiadas (watch = true) de uma organização com o scraper próprio. */
export async function runWatchForOrg(supabase: SupabaseClient<Database>, orgId: string): Promise<ScanSummary | null> {
  const { data: offers, error } = await supabase
    .from("garimpo_offers")
    .select("id, country")
    .eq("org_id", orgId)
    .eq("watch", true);
  if (error) throw new Error(error.message);
  if (!offers?.length) return null;

  const { data: pages, error: pagesError } = await supabase
    .from("garimpo_pages")
    .select("page_id_meta")
    .eq("org_id", orgId)
    .in("offer_id", offers.map((o) => o.id));
  if (pagesError) throw new Error(pagesError.message);

  const pageIds = [...new Set((pages ?? []).map((p) => p.page_id_meta))];
  if (!pageIds.length) return null;

  const countries = new Set(offers.map((o) => o.country).filter(Boolean));
  return runScan(supabase, {
    orgId,
    source: "scraper_proprio",
    niche: "ofertas vigiadas",
    country: countries.size === 1 ? [...countries][0]! : "",
    pageIds,
  });
}
