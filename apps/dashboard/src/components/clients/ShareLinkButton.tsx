"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import ShareLinkModal from "./ShareLinkModal";

interface ShareLinkButtonProps {
  clientId: string;
  clientName: string;
}

export function ShareLinkButton({ clientId, clientName }: ShareLinkButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors border border-slate-700"
      >
        <Share2 size={18} />
        Compartilhar
      </button>

      <ShareLinkModal
        clientId={clientId}
        clientName={clientName}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
