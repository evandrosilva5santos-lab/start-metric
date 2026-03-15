import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types.js";

type SupabaseEnvName = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function requireEnv(name: SupabaseEnvName): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[supabase/server] Missing required environment variable: ${name}. ` +
        "Configure it in your deployment provider and local .env file.",
    );
  }
  return value;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where mutating cookies is not allowed.
          }
        },
      },
    },
  );
}
