import { notFound, redirect } from "next/navigation";
import { getServerSupabase, getSessionProfile } from "@/lib/auth/session";
import { registrableDomain } from "@/lib/garimpo/domain";
import { getOfferDetail } from "@/lib/garimpo/queries";
import { OfferDetailClient } from "@/components/garimpo/OfferDetailClient";

export const metadata = {
  title: "Garimpo | Start Metric",
};

function nowIso() {
  return new Date().toISOString();
}

import { cookies } from "next/headers";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";

export default async function GarimpoDomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = registrableDomain(decodeURIComponent(raw).trim().toLowerCase());
  if (!domain) notFound();

  const cookieStore = await cookies();
  const painelCookie = cookieStore.get(PAINEL_COOKIE_NAME)?.value;
  const isPainel = await isPainelAuthorized(painelCookie);

  const profile = await getSessionProfile();
  if (!isPainel && !profile) redirect("/auth");

  const supabase = await getServerSupabase();
  let orgId = profile?.orgId;

  if (!orgId && isPainel) {
    try {
      const { data: org } = await supabase.from("organizations").select("id").limit(1).maybeSingle();
      orgId = org?.id ?? "00000000-0000-0000-0000-000000000000";
    } catch {
      orgId = "00000000-0000-0000-0000-000000000000";
    }
  }

  if (!orgId) notFound();

  const data = await getOfferDetail(supabase, orgId, domain);
  if (!data) notFound();
  return <OfferDetailClient data={data} generatedAt={nowIso()} />;
}
