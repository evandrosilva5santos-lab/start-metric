// Visão geral do Google Ads: indicadores, evolução diária e campanhas das contas do painel.

import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/auth/session";
import { GoogleAdsDashboard } from "@/components/google/GoogleAdsDashboard";

export const metadata = {
  title: "Google Ads | Start Metric",
  description: "Investimento, cliques, conversões e campanhas do Google Ads por cliente.",
};

export default async function GoogleAdsPage() {
  const session = await getDashboardSession();
  if (!session.isAuthorized) redirect("/auth");
  return <GoogleAdsDashboard />;
}
