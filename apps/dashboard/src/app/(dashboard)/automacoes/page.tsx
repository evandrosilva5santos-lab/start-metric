import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/auth/session";
import { AutomationsClient } from "@/components/automation/AutomationsClient";

export const metadata = {
  title: "Automações | Start Metric",
  description: "Regras que pausam, ativam ou ajustam o orçamento das campanhas sozinhas.",
};

export default async function AutomationsPage() {
  const session = await getDashboardSession();
  if (!session.isAuthorized) redirect("/auth");

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-primary">Gestão</p>
        <h1 className="text-3xl font-extrabold leading-none tracking-tight text-fg">Automações</h1>
        <p className="mt-1 text-sm text-fg-muted">Regras que vigiam as campanhas da Meta e do Google e agem por você.</p>
      </div>
      <AutomationsClient />
    </div>
  );
}
