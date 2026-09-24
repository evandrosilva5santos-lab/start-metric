"use client";

import { useEffect, useState } from "react";

export type SessionIdentity = {
  email: string | null;
  name: string | null;
};

/**
 * Lê a identidade que o layout do servidor já resolveu e envia junto com a
 * página, em vez de o navegador perguntar de novo ao Supabase.
 */
export function useSessionIdentity(identity?: Promise<SessionIdentity>): SessionIdentity | null {
  const [value, setValue] = useState<SessionIdentity | null>(null);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    // A promessa que vem do servidor é um thenable sem .catch: embrulhar.
    Promise.resolve(identity).then(
      (resolved) => {
        if (active) setValue(resolved);
      },
      () => {
        // Sem identidade: os componentes mostram o estado neutro.
      },
    );
    return () => {
      active = false;
    };
  }, [identity]);

  return value;
}
