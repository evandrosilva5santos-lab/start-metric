"use client";

import { useQuery } from "@tanstack/react-query";
import type { TaxonomyItem, TaxonomyKind } from "@/lib/clients/taxonomy";

export const taxonomyKey = (kind: TaxonomyKind) => ["taxonomy", kind] as const;

/** Segmentos ou produtos da organização, em ordem alfabética. */
export function useTaxonomy(kind: TaxonomyKind) {
  return useQuery({
    queryKey: taxonomyKey(kind),
    queryFn: async (): Promise<TaxonomyItem[]> => {
      const res = await fetch(`/api/taxonomy/${kind}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { data?: TaxonomyItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      return json.data ?? [];
    },
    staleTime: 60_000,
  });
}
