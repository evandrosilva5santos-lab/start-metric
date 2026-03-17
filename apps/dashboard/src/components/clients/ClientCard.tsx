"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Phone, Edit, Archive, Eye, MessageCircle } from "lucide-react";

export type ClientCardData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  notes: string | null;
  accounts_count: number;
  created_at: string;
  updated_at: string;
  whatsapp_status?: string;
  whatsapp_connected?: boolean;
  whatsapp_last_connected_at?: string | null;
};

type WhatsAppBadgeConfig = {
  label: string;
  className: string;
};

function getWhatsAppBadge(status?: string): WhatsAppBadgeConfig {
  if (status === "connected") {
    return {
      label: "WhatsApp conectado",
      className: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20",
    };
  }

  if (status === "connecting" || status === "pending") {
    return {
      label: "WhatsApp conectando",
      className: "bg-amber-500/10 text-amber-300 border-amber-400/20",
    };
  }

  if (status === "error") {
    return {
      label: "WhatsApp com erro",
      className: "bg-red-500/10 text-red-300 border-red-400/20",
    };
  }

  return {
    label: "WhatsApp não conectado",
    className: "bg-slate-700/30 text-slate-300 border-slate-600/40",
  };
}

type ClientCardProps = {
  client: ClientCardData;
  getInitials: (name: string) => string;
  onEdit: (client: ClientCardData) => void;
  onArchive: (clientId: string) => void;
};

export function ClientCard({
  client,
  getInitials,
  onEdit,
  onArchive,
}: ClientCardProps) {
  const whatsappBadge = getWhatsAppBadge(client.whatsapp_status);

  return (
    <motion.div
      key={client.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-400/5 transition-all duration-300"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400/20 to-indigo-600/20 flex items-center justify-center border border-cyan-400/20 flex-shrink-0">
          {client.logo_url ? (
            <img
              src={client.logo_url}
              alt={client.name}
              className="w-full h-full rounded-xl object-cover"
            />
          ) : (
            <span className="text-cyan-400 font-bold text-sm">
              {getInitials(client.name)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{client.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="bg-slate-800 text-slate-400 rounded-full px-2 py-0.5 text-xs font-medium">
              {client.accounts_count} {client.accounts_count === 1 ? "conta" : "contas"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(client)}
            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onArchive(client.id)}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            title="Arquivar"
          >
            <Archive size={16} />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${whatsappBadge.className}`}
        >
          <MessageCircle size={12} />
          {whatsappBadge.label}
        </span>
      </div>

      <div className="space-y-2">
        {client.email && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Mail size={14} className="flex-shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Phone size={14} className="flex-shrink-0" />
            <span>{client.phone}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Criado em {new Date(client.created_at).toLocaleDateString("pt-BR")}
        </span>
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 font-medium"
        >
          <Eye size={14} />
          Ver detalhes
        </Link>
      </div>
    </motion.div>
  );
}

