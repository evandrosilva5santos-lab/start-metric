import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";
import { ClientsPageClient } from "./ClientsPageClient";

export const metadata: Metadata = {
  title: "Clientes | Start Metric",
  description: "Gerencie seus clientes e suas contas de anúncio.",
};

export default async function ClientsPage() {
  const cookieStore = await cookies();
  const painelCookie = cookieStore.get(PAINEL_COOKIE_NAME)?.value;
  const isPainel = await isPainelAuthorized(painelCookie);

  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {}

  if (!isPainel && !user) {
    redirect("/auth");
  }

  return <ClientsPageClient />;
}

