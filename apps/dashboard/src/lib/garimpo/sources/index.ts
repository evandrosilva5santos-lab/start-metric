import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createApiOficialSource } from "./api-oficial";
import { createScraperProprioSource } from "./scraper-proprio";
import { createTerceiroSource } from "./terceiro";
import type { AdSource, SourceId } from "./types";

export function getSource(id: SourceId, ctx: { supabase: SupabaseClient<Database>; orgId: string }): AdSource {
  switch (id) {
    case "api_oficial":
      return createApiOficialSource(ctx);
    case "terceiro":
      return createTerceiroSource();
    case "scraper_proprio":
      return createScraperProprioSource();
  }
}
