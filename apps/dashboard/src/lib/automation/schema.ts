import { z } from "zod";

const METRICS = ["cpa", "roas", "ctr", "cpc", "cpm", "spend", "conversions"] as const;
const OPERATORS = ["above", "below"] as const;
const PERIODS = ["today", "yesterday", "last_3d", "last_7d"] as const;
const ACTIONS = ["pause", "activate", "decrease_budget", "increase_budget", "notify"] as const;

const budgetNeedsPercent = (v: { action?: string; actionPercent?: number | null }) =>
  !(v.action === "increase_budget" || v.action === "decrease_budget") || (v.actionPercent ?? null) !== null;

const fields = {
  name: z.string().trim().min(1, "Dê um nome à regra").max(120),
  metric: z.enum(METRICS),
  operator: z.enum(OPERATORS),
  value: z.number().finite().min(0, "O limite não pode ser negativo").max(10_000_000),
  period: z.enum(PERIODS),
  minSpend: z.number().finite().min(0).max(10_000_000),
  action: z.enum(ACTIONS),
  actionPercent: z.number().int().min(1).max(100).nullable(),
  cooldownHours: z.number().int().min(1).max(720),
  maxActionsPerDay: z.number().int().min(1).max(50),
  entityExternalId: z.string().regex(/^\d{1,32}$/, "Campanha inválida").nullable(),
  entityName: z.string().trim().max(500).nullable(),
};

/** Regra nova sempre nasce em modo simular; não há campo de modo na criação. */
export const ruleCreateSchema = z
  .object({
    ...fields,
    adAccountId: z.string().uuid(),
    period: fields.period.default("last_3d"),
    minSpend: fields.minSpend.default(0),
    actionPercent: fields.actionPercent.default(null),
    cooldownHours: fields.cooldownHours.default(24),
    maxActionsPerDay: fields.maxActionsPerDay.default(3),
    entityExternalId: fields.entityExternalId.default(null),
    entityName: fields.entityName.default(null),
  })
  .strict()
  .refine(budgetNeedsPercent, { message: "Informe a porcentagem do ajuste de orçamento", path: ["actionPercent"] });

/** Trocar para "execute" mexe na conta do cliente: exige confirmExecute = true no mesmo pedido. */
export const ruleUpdateSchema = z
  .object({
    name: fields.name.optional(),
    metric: fields.metric.optional(),
    operator: fields.operator.optional(),
    value: fields.value.optional(),
    period: fields.period.optional(),
    minSpend: fields.minSpend.optional(),
    action: fields.action.optional(),
    actionPercent: fields.actionPercent.optional(),
    cooldownHours: fields.cooldownHours.optional(),
    maxActionsPerDay: fields.maxActionsPerDay.optional(),
    isActive: z.boolean().optional(),
    mode: z.enum(["simulate", "execute"]).optional(),
    confirmExecute: z.literal(true).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).some((k) => k !== "confirmExecute"), { message: "Nada para alterar" })
  .refine((v) => v.mode !== "execute" || v.confirmExecute === true, {
    message: "Confirme que a regra pode mexer na conta do cliente",
    path: ["confirmExecute"],
  });

export type RuleCreateInput = z.infer<typeof ruleCreateSchema>;
export type RuleUpdateInput = z.infer<typeof ruleUpdateSchema>;
