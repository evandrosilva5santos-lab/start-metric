import { z } from "zod";

export const TRIAGE_PAGE_LIMIT_MAX = 100;
export const RESOLUTION_NOTE_MAX = 2000;
export const TEMPLATE_BODY_MAX = 4000;
const THRESHOLD_MAX = 1_000_000_000;

export const SUPPORTED_RULE_METRICS = ["roas", "cpa", "spend_no_conversion", "ctr_below", "api_error"] as const;

const uuid = z.string().uuid();

export const triageQuerySchema = z.object({
  state: z.enum(["open", "acknowledged", "resolved", "all"]).default("open"),
  severity: z.enum(["critical", "warning", "info", "all"]).default("all"),
  assigned_to: z.union([z.enum(["me", "unassigned", "all"]), uuid]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(TRIAGE_PAGE_LIMIT_MAX).default(25),
});

export type TriageQuery = z.infer<typeof triageQuerySchema>;

export function parseTriageQuery(params: URLSearchParams) {
  const raw: Record<string, string> = {};
  for (const key of ["state", "severity", "assigned_to", "page", "limit"]) {
    const value = params.get(key);
    if (value !== null && value.trim() !== "") raw[key] = value.trim();
  }
  return triageQuerySchema.safeParse(raw);
}

export const alertIdSchema = uuid;

export const resolveBodySchema = z.object({
  note: z
    .string({ required_error: "Escreva uma nota para resolver." })
    .trim()
    .min(1, "Escreva uma nota para resolver.")
    .max(RESOLUTION_NOTE_MAX, `A nota aceita até ${RESOLUTION_NOTE_MAX} caracteres.`),
});

export const assignBodySchema = z
  .object({
    assigned_to: uuid.nullable(),
  })
  .strict();

const ruleFields = {
  metric: z.enum(SUPPORTED_RULE_METRICS),
  operator: z.enum(["lt", "gt", "eq"]).optional(),
  threshold: z.number().finite().min(0).max(THRESHOLD_MAX),
  campaign_id: uuid.nullable().optional(),
  client_id: uuid.nullable().optional(),
  ad_account_id: uuid.nullable().optional(),
  template_body: z.string().max(TEMPLATE_BODY_MAX).nullable().optional(),
  active: z.boolean().optional(),
};

export const ruleCreateSchema = z.object(ruleFields).strict();

export const ruleUpdateSchema = z
  .object(ruleFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Nada para atualizar" });

export type RuleCreateInput = z.infer<typeof ruleCreateSchema>;
export type RuleUpdateInput = z.infer<typeof ruleUpdateSchema>;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos";
}
