import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

type PublicSupabaseEnvName =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function requirePublicEnv(
  name: PublicSupabaseEnvName,
  rawValue: string | undefined,
): string {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error(
      `[supabase/client] Missing required environment variable: ${name}. ` +
        "Configure it in your deployment provider and local .env file, then redeploy.",
    );
  }
  return value;
}

export function createClient() {
  return createBrowserClient<Database>(
    requirePublicEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    requirePublicEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  );
}
