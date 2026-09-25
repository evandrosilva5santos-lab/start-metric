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

export default async function GarimpoDomainPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain: raw } = await params;
  const domain = registrableDomain(decodeURIComponent(raw).trim().toLowerCase());
  if (!domain) notFound();

  const profile = await getSessionProfile();
  if (!profile) redirect("/auth");
  if (!profile.orgId) notFound();

  const supabase = await getServerSupabase();
  const data = await getOfferDetail(supabase, profile.orgId, domain);
  if (!data) notFound();
  return <OfferDetailClient data={data} generatedAt={nowIso()} />;
}
