import Link from "next/link";
import { Suspense } from "react";
import { AlertRulesSection, AlertRulesSectionSkeleton } from "@/components/alerts/AlertRulesSection";
import { AlertsTriage } from "@/components/alerts/triage/AlertsTriage";
import { TriageListSkeleton } from "@/components/alerts/triage/TriageList";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Alertas | Start Metric",
  description: "Triagem de alertas por cliente: abertos, reconhecidos e resolvidos.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const TABS = [
  { id: "triagem", label: "Triagem", href: "/alertas" },
  { id: "regras", label: "Regras", href: "/alertas?tab=regras" },
] as const;

function toUrlParams(searchParams: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

export default async function AlertasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = toUrlParams(await searchParams);
  const tab = params.get("tab") === "regras" ? "regras" : "triagem";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[20px] font-semibold leading-[1.3] text-fg lg:text-[24px]">Alertas</h1>
        <p className="max-w-2xl text-[14px] text-fg-muted">
          O que disparou em cada cliente e de quem é a próxima ação. Alerta é um sinal para olhar, não um diagnóstico.
        </p>
      </header>

      <nav aria-label="Seções de alertas" className="flex gap-1 border-b border-border">
        {TABS.map((item) => {
          const isActive = item.id === tab;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex h-11 items-center border-b-2 px-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9",
                isActive ? "border-primary text-primary" : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "triagem" ? (
        <Suspense fallback={<TriageListSkeleton />}>
          <AlertsTriage />
        </Suspense>
      ) : (
        <Suspense fallback={<AlertRulesSectionSkeleton />}>
          <AlertRulesSection />
        </Suspense>
      )}
    </div>
  );
}
