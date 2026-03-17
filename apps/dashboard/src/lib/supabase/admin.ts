import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function requireServerEnv(name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value =
    name === "SUPABASE_URL"
      ? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.SUPABASE_SERVICE_ROLE_KEY;

  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(
      `[supabase/admin] Missing required environment variable: ${name}. ` +
        "Configure it in your deployment provider and local .env file.",
    );
  }

  return normalized;
}

export function createAdminClient() {
  return createSupabaseClient(
    requireServerEnv("SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
