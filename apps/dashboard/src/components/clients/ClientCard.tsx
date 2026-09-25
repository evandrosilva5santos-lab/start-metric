"use client";

import Link from "next/link";
import { Archive, MessageCircle, Pencil, Tag } from "lucide-react";
import { formatWhatsapp } from "@/lib/clients/schema";

export type ClientCardData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  niche: string | null;
  logo_url: string | null;
  notes: string | null;
  accounts_count: number;
  created_at: string;
  updated_at: string;
  whatsapp_status?: string;
  whatsapp_connected?: boolean;
  whatsapp_last_connected_at?: string | null;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const iconButton =
  "flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ClientCard({
  client,
  onEdit,
  onArchive,
}: {
  client: ClientCardData;
  onEdit: (client: ClientCardData) => void;
  onArchive: (clientId: string) => void;
}) {
  return (
    <li className="flex min-w-0 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-dim text-sm font-bold text-primary">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo em URL livre do cliente
            <img src={client.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(client.name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/clients/${client.id}`}
            className="block truncate font-display text-base font-semibold text-foreground hover:text-primary"
            title={client.name}
          >
            {client.name}
          </Link>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-text-secondary">
            <Tag size={12} className="shrink-0" />
            {client.niche || "—"}
          </p>
        </div>
        <div className="-mr-2 -mt-2 flex shrink-0">
          <button type="button" onClick={() => onEdit(client)} aria-label={`Editar ${client.name}`} className={iconButton}>
            <Pencil size={16} />
          </button>
          <button type="button" onClick={() => onArchive(client.id)} aria-label={`Arquivar ${client.name}`} className={iconButton}>
            <Archive size={16} />
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-t border-border text-sm">
        <div className="border-r border-border px-4 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Contas</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{client.accounts_count}</dd>
        </div>
        <div className="min-w-0 px-4 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">WhatsApp</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 truncate tabular-nums text-text-primary">
            <MessageCircle size={13} className={client.whatsapp_connected ? "text-primary" : "text-text-muted"} />
            {client.whatsapp ? formatWhatsapp(client.whatsapp) : "—"}
          </dd>
        </div>
      </dl>

      <Link
        href={`/clients/${client.id}`}
        className="flex h-11 items-center justify-center border-t border-border text-sm font-semibold text-primary hover:bg-primary-dim"
      >
        {client.accounts_count > 0 ? "Abrir cliente" : "Buscar contas de anúncio"}
      </Link>
    </li>
  );
}
