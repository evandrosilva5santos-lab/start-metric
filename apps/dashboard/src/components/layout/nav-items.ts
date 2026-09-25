import {
  LayoutDashboard,
  Megaphone,
  Image as ImageIcon,
  Target,
  Clock,
  Stethoscope,
  TrendingUp,
  Users,
  FileText,
  Settings,
  Pickaxe,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { icon: LucideIcon; label: string; href: string };

export const META_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Visão geral", href: "/" },
  { icon: Megaphone, label: "Campanhas", href: "/campaigns" },
  { icon: ImageIcon, label: "Criativos", href: "/criativos" },
  { icon: Target, label: "Rastreamento", href: "/tracking" },
  { icon: Clock, label: "Horário", href: "/horario" },
  { icon: Stethoscope, label: "Diagnóstico", href: "/diagnostico" },
];

/** Olha a Biblioteca de Anúncios, não as campanhas do usuário: sem controles da Meta no cabeçalho. */
export const DISCOVER_NAV: NavItem[] = [{ icon: Pickaxe, label: "Garimpo", href: "/garimpo" }];

export const MANAGE_NAV: NavItem[] = [
  { icon: Users, label: "Clientes", href: "/clients" },
  { icon: FileText, label: "Relatórios", href: "/reports" },
  { icon: Settings, label: "Configurações", href: "/settings" },
];

/** Telas que leem conta e período da Meta e mostram os controles no cabeçalho. */
export function isMetaPath(pathname: string): boolean {
  return META_NAV.some((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)));
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
