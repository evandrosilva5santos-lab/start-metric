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

import { cookies } from "next/headers";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";

async function GarimpoDataLoader() {
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

  if (!orgId) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Garimpo</h1>
        <p className="mt-2 text-sm text-text-secondary">Sua conta ainda não está ligada a uma organização. Fale com o administrador.</p>
      </div>
    );
  }

  const data = await getGarimpoOverview(supabase, orgId);
  return <GarimpoClient data={data} generatedAt={nowIso()} />;
}

export default function GarimpoPage() {
  return (
    <Suspense fallback={<SkeletonGarimpoGrid />}>
      <GarimpoDataLoader />
    </Suspense>
  );
}
