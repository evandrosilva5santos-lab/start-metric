import { z } from "zod";

/** Só dígitos com DDI; número brasileiro de 10 ou 11 dígitos ganha o 55. */
export function normalizeWhatsapp(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** 5511987654321 → +55 (11) 98765-4321; outros formatos voltam como +dígitos. */
export function formatWhatsapp(value: string | null | undefined): string {
  if (!value) return "";
  const d = value.replace(/\D/g, "");
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (m) return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
  return `+${d}`;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const whatsappField = z
  .string()
  .trim()
  .max(25)
  .transform((v, ctx) => {
    if (v === "") return null;
    const normalized = normalizeWhatsapp(v);
    if (!normalized || normalized.length < 12 || normalized.length > 15) {
      ctx.addIssue({ code: "custom", message: "WhatsApp inválido. Use DDD + número, ex.: (11) 98765-4321" });
      return z.NEVER;
    }
    return normalized;
  })
  .nullable()
  .optional();

export const clientFieldsSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  phone: optionalText(25),
  whatsapp: whatsappField,
  niche: optionalText(80),
  logo_url: z
    .string()
    .trim()
    .url("URL inválida")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  notes: optionalText(2000),
});

export const createClientSchema = clientFieldsSchema;
export const updateClientSchema = clientFieldsSchema.partial();
