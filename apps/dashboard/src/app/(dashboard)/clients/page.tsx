import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ClientsPageClient } from "./ClientsPageClient";

export const metadata: Metadata = {
  title: "Clientes | Start Metric",
  description: "Gerencie seus clientes e suas contas de anúncio.",
};

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth");
  }

  return <ClientsPageClient />;
}
