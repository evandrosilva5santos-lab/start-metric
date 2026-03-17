"use client";

import { MessageCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

type WhatsAppConnectionPanelProps = {
  clientId: string;
  clientName: string;
};

export function WhatsAppConnectionPanel({ clientId, clientName }: WhatsAppConnectionPanelProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold text-white">Conexão WhatsApp</h3>
          <p className="text-sm text-slate-400 max-w-md">
            A funcionalidade de WhatsApp será implementada no Sprint 4.
            Esta página permitirá conectar instâncias do WhatsApp para automações e relatórios.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MessageCircle size={14} />
          <span>Em desenvolvimento</span>
        </div>
      </motion.div>
    </div>
  );
}
