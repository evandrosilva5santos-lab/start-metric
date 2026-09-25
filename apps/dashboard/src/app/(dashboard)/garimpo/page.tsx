import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSupabase, getSessionProfile } from "@/lib/auth/session";
import { getGarimpoOverview } from "@/lib/garimpo/queries";
import { GarimpoClient } from "@/components/garimpo/GarimpoClient";
import { SkeletonGarimpoGrid } from "@/components/ui/Skeleton";

export const metadata = {
  title: "Garimpo | Start Metric",
  description: "Quem está gastando num nicho, agrupado pelo domínio de destino.",
};

// A varredura roda numa server action desta página.
export const maxDuration = 300;

function nowIso() {
  return new Date().toISOString();
}

async function GarimpoDataLoader() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/auth");
  if (!profile.orgId) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Garimpo</h1>
        <p className="mt-2 text-sm text-text-secondary">Sua conta ainda não está ligada a uma organização. Fale com o administrador.</p>
      </div>
    );
  }
  const supabase = await getServerSupabase();
  const data = await getGarimpoOverview(supabase, profile.orgId);
  return <GarimpoClient data={data} generatedAt={nowIso()} />;
}

export default function GarimpoPage() {
  return (
    <Suspense fallback={<SkeletonGarimpoGrid />}>
      <GarimpoDataLoader />
    </Suspense>
  );
}
