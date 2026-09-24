"use client";

import Link from "next/link";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { formatMoney } from "@/lib/format";
import { MetaDataGate, PageHeading, SectionCard } from "@/components/meta/MetaUi";
import { AvisoList } from "@/components/meta/AvisoList";
import { SituationPill } from "@/components/dashboard/DashboardClient";
import type { DadosResponse } from "@/lib/meta/dados-types";

export function needsAttention(c: { situacao: string; results: number; spend: number }): boolean {
  return c.situacao === "SEM_ENTREGA" || (c.results === 0 && c.spend > 100);
}

export function DiagnosticoClient() {
  return (
    <div className="space-y-6">
      <PageHeading title="Diagnóstico" subtitle="Avisos em português, com o que fazer em cada caso" />
      <MetaDataGate>{(data) => <Diagnostico data={data} />}</MetaDataGate>
    </div>
  );
}

function Diagnostico({ data }: { data: DadosResponse }) {
  const hide = useDashboardFilters((s) => s.hideValues);
  const attention = data.campanhas.filter(needsAttention);
  const gargalo = data.funil.gargalo;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <SectionCard title="Avisos da conta" subtitle={`${data.avisos.length} no período`} className="xl:col-span-7">
        <AvisoList avisos={data.avisos} />
      </SectionCard>

      <div className="space-y-6 xl:col-span-5">
        <SectionCard title="Gargalo do funil" subtitle="Onde as pessoas mais desistem">
          <p className={`text-sm font-semibold ${gargalo.etapa === "Nenhum" ? "text-primary" : "text-warning"}`}>
            {gargalo.etapa}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{gargalo.explicacao}</p>
        </SectionCard>

        <SectionCard title="Campanhas que precisam de você" subtitle="Sem entrega ou gastando sem resultado">
          {attention.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhuma campanha nessa situação.</p>
          ) : (
            <ul className="divide-y divide-border">
              {attention.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <Link
                    href={`/campaigns?id=${encodeURIComponent(c.id)}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary"
                    title={c.name}
                  >
                    {c.name}
                  </Link>
                  <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                    {formatMoney(c.spend, data.conta.currency, hide)}
                  </span>
                  <SituationPill situacao={c.situacao} label={c.situacaoLabel} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
