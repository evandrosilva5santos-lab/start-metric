// Segmentos e produtos: etiquetas para organizar e filtrar os clientes da Carteira.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/auth/session";
import { TaxonomyManager } from "@/components/clients/TaxonomyManager";

export const metadata = {
  title: "Segmentos e produtos | Start Metric",
  description: "Organize os clientes da Carteira por segmento e por produto contratado.",
};

export default async function TaxonomyPage() {
  const session = await getDashboardSession();
  if (!session.isAuthorized) redirect("/auth");

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-primary">Configurações</p>
        <h1 className="text-3xl font-extrabold leading-none tracking-tight text-fg">Segmentos e produtos</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Etiquetas para organizar a{" "}
          <Link href="/clients" className="font-semibold text-primary hover:underline">
            Carteira
          </Link>
          : escolha no cadastro de cada cliente e filtre a lista por elas.
        </p>
      </div>
      <TaxonomyManager />
    </div>
  );
}
