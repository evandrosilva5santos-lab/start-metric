import { z } from "zod";

/** Paleta das etiquetas; a primeira é o padrão (teal do Start Metric). */
export const TAXONOMY_COLORS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#475569",
] as const;

const TABLES = { segments: "client_segments", products: "client_products" } as const;

export type TaxonomyKind = keyof typeof TABLES;
export type TaxonomyTable = (typeof TABLES)[TaxonomyKind];

export type TaxonomyItem = { id: string; name: string; color: string };

export const TAXONOMY_LABELS: Record<TaxonomyKind, { singular: string; plural: string }> = {
  segments: { singular: "Segmento", plural: "Segmentos" },
  products: { singular: "Produto", plural: "Produtos" },
};

/** Só os dois tipos conhecidos viram nome de tabela; qualquer outro valor da URL é recusado. */
export function taxonomyTable(kind: string): TaxonomyTable | null {
  return Object.hasOwn(TABLES, kind) ? TABLES[kind as TaxonomyKind] : null;
}

export const taxonomyItemSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome").max(60, "Use até 60 caracteres"),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
      .default(TAXONOMY_COLORS[0]),
  })
  .strict();

export const taxonomyUpdateSchema = taxonomyItemSchema.partial().strict();
