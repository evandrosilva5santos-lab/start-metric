import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

export function logCampaignActionInBackground(campaignId: string | number, status: string): void {
  setImmediate(async () => {
    try {
      const supabase = getSupabase();
      if (!supabase) return;

      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("campaigns") as any)
        .update({
          status: status,
          last_synced_at: now,
        })
        .eq("meta_id", String(campaignId));

      console.log(`[supabase-sync] ✅ Ação na campanha ${campaignId} (${status}) registrada no Supabase.`);
    } catch (err) {
      console.warn("[supabase-sync] Erro ao registrar ação de campanha no Supabase:", err);
    }
  });
}
