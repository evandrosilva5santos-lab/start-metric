import {
  LayoutDashboard,
  Bell,
  TrendingUp,
  Megaphone,
  Image as ImageIcon,
  Target,
  Clock,
  Stethoscope,
  Pickaxe,
  Briefcase,
  FileText,
  Plug,
  Settings,
  Search,
  Menu,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { icon: LucideIcon; label: string; href: string };
export type NavGroup = { label: string; items: NavItem[] };

export const DIAGNOSTIC_HREF = "/diagnostico";

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Início",
    items: [
      { icon: LayoutDashboard, label: "Visão geral", href: "/" },
      { icon: Bell, label: "Alertas", href: "/alertas" },
    ],
  },
  {
    label: "Meta Ads",
    items: [
      { icon: TrendingUp, label: "Performance", href: "/performance" },
      { icon: Megaphone, label: "Campanhas", href: "/campaigns" },
      { icon: ImageIcon, label: "Criativos", href: "/criativos" },
      { icon: Target, label: "Rastreamento", href: "/tracking" },
      { icon: Clock, label: "Horário", href: "/horario" },
      { icon: Stethoscope, label: "Diagnóstico", href: DIAGNOSTIC_HREF },
    ],
  },
  {
    label: "Google Ads",
    items: [{ icon: Search, label: "Visão Google", href: "/google-ads" }],
  },
  {
    label: "Descoberta",
    items: [{ icon: Pickaxe, label: "Garimpo", href: "/garimpo" }],
  },
  {
    label: "Gestão",
    items: [
      { icon: Briefcase, label: "Carteira", href: "/clients" },
      { icon: FileText, label: "Relatórios", href: "/reports" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { icon: Plug, label: "Integrações", href: "/settings/meta" },
      { icon: Settings, label: "Configurações", href: "/settings" },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const MORE_ICON = Menu;

export const BOTTOM_BAR_HREFS = ["/", "/alertas", "/clients", "/reports"];

const LIVE_META_PATHS = ["/campaigns", "/criativos", "/tracking", "/horario", DIAGNOSTIC_HREF];

const EXTRA_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: "/clients/", title: "Cliente 360°" },
  { prefix: "/settings/profile", title: "Meu perfil" },
  { prefix: "/settings/google", title: "Integrações" },
  { prefix: "/settings/taxonomy", title: "Segmentos e produtos" },
  { prefix: "/accounts", title: "Contas de anúncio" },
  { prefix: "/garimpo/", title: "Garimpo" },
];

function matchesPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of ALL_NAV_ITEMS) {
    if (matchesPath(pathname, item.href) && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}

export function isActivePath(pathname: string, href: string): boolean {
  return activeNavHref(pathname) === href;
}

export function isOverviewPath(pathname: string): boolean {
  return pathname === "/";
}

export function isMetaPath(pathname: string): boolean {
  return LIVE_META_PATHS.some((href) => matchesPath(pathname, href));
}

export function pageTitle(pathname: string): string {
  const extra = EXTRA_TITLES.find((entry) => pathname.startsWith(entry.prefix));
  if (extra) return extra.title;
  const active = activeNavHref(pathname);
  return ALL_NAV_ITEMS.find((item) => item.href === active)?.label ?? "Start Metric";
}
