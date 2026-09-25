"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui";
import { ClientModal, type EditableClient } from "@/components/clients/ClientModal";

export function ClientEditButton({ client }: { client: EditableClient }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="h-11">
        <Pencil size={16} />
        Editar
      </Button>
      {open && (
        <ClientModal
          isOpen={open}
          client={client}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
