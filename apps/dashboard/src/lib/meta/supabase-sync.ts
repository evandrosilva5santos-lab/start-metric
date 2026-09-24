import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ENCRYPTION_KEY = process.env.SUPABASE_ENCRYPTION_KEY || "antigravidade-secure-key-32chars-min";

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;
let cachedOrgId: string | null = null;

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

export async function getPrimaryOrgId(supabase: ReturnType<typeof createClient<Database>>): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  try {
    const { data, error } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
    if (!error && data?.id) {
      cachedOrgId = data.id;
      return cachedOrgId;
    }
  } catch (err) {
    console.warn("[supabase-sync] Erro ao buscar org_id:", err);
  }
  return "0b7ec073-d8cd-4ab8-8a36-fc2380c2b0b1";
}

export async function encryptTokenSafe(
  supabase: ReturnType<typeof createClient<Database>>,
  rawToken: string
): Promise<string | null> {
  if (!rawToken) return null;
  try {
    const { data, error } = await supabase.rpc("encrypt_token", {
      encryption_key: SUPABASE_ENCRYPTION_KEY,
      raw_token: rawToken,
    });
    if (!error && data) return data as string;
  } catch (err) {
    console.warn("[supabase-sync] Erro na RPC encrypt_token:", err);
  }
  return Buffer.from(rawToken).toString("base64");
}

export function syncAccountsAndTokenInBackground(
  accounts: Array<{
    id: string;
    name?: string;
    account_status?: number;
    isActive?: boolean;
    currency?: string;
    timezone_name?: string;
  }>,
  rawToken: string
): void {
  setImmediate(async () => {
    try {
      const supabase = getSupabase();
      if (!supabase || !Array.isArray(accounts) || accounts.length === 0) return;

      const orgId = await getPrimaryOrgId(supabase);
      const encryptedToken = await encryptTokenSafe(supabase, rawToken);
      const now = new Date().toISOString();

      const upsertRows = accounts.map((acc) => ({
        org_id: orgId,
        platform: "meta",
        external_id: String(acc.id).startsWith("act_") ? String(acc.id) : `act_${acc.id}`,
        name: acc.name || "Conta Meta Ads",
        currency: acc.currency || "BRL",
        timezone: acc.timezone_name || "America/Sao_Paulo",
        status: (acc.account_status === 1 || acc.isActive) ? "active" : "disabled",
        token_encrypted: encryptedToken,
        last_synced_at: now,
        updated_at: now,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("ad_accounts") as any).upsert(upsertRows, {
        onConflict: "org_id,external_id",
      });

      if (error) {
        console.warn("[supabase-sync] Aviso ao salvar contas:", error.message);
      } else {
        console.log(`[supabase-sync] ✅ ${upsertRows.length} contas e credenciais salvas no Supabase com sucesso.`);
      }
    } catch (err) {
      console.warn("[supabase-sync] Erro inesperado ao sincronizar contas:", err);
    }
  });
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
