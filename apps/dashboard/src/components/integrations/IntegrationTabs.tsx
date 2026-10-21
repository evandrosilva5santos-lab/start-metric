// Abas das integrações de mídia (Meta Ads | Google Ads), no topo de cada página de conexão.

import Link from "next/link";

const TABS = [
  { id: "meta", label: "Meta Ads", href: "/settings/meta" },
  { id: "google", label: "Google Ads", href: "/settings/google" },
] as const;

export function IntegrationTabs({ active }: { active: (typeof TABS)[number]["id"] }) {
  return (
    <nav aria-label="Integrações de mídia" className="flex gap-1 border-b border-border">
      {TABS.map((tab) => {
        const current = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors ${
              current ? "border-primary text-primary" : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
