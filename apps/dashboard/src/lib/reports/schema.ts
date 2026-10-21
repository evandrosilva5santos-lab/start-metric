import { z } from "zod";
import { DEFAULT_REPORT_TIMEZONE, REPORT_PERIODS, isIsoDate, isValidTimeZone } from "./period";
import { REPORT_FREQUENCIES } from "./schedule";

export const REPORT_STATUSES = ["active", "paused", "draft"] as const;
export const DELIVERY_STEPS = ["sent", "received", "approved"] as const;

export const MAX_PARTS = 30;
export const MAX_BODY_LENGTH = 20_000;
export const MAX_NOTE_LENGTH = 2000;

const isoDate = z.string().refine(isIsoDate, "Data inválida (use AAAA-MM-DD)");
const timeZone = z.string().refine(isValidTimeZone, "Fuso horário inválido");
const sendTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:00)?$/, "Horário inválido (use HH:MM)");
const uuid = z.string().uuid("ID inválido");

interface CustomRange {
  period: string;
  custom_start?: string | null;
  custom_end?: string | null;
}

function checkCustomRange(value: CustomRange, ctx: z.RefinementCtx, keys = { start: "custom_start", end: "custom_end" }): void {
  if (value.period !== "custom") return;
  if (!value.custom_start || !value.custom_end || value.custom_start > value.custom_end) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [keys.start],
      message: "Período personalizado exige início e fim, com início ≤ fim",
    });
  }
}

interface ScheduleShape {
  frequency?: string;
  weekday?: number | null;
  month_day?: number | null;
}

function checkSchedule(value: ScheduleShape, ctx: z.RefinementCtx): void {
  if (value.frequency === "weekly" && (value.weekday === null || value.weekday === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weekday"], message: "Relatório semanal exige o dia da semana" });
  }
  if (value.frequency === "monthly" && (value.month_day === null || value.month_day === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["month_day"], message: "Relatório mensal exige o dia do mês" });
  }
}

export const reportPartSchema = z
  .object({
    ad_account_id: uuid.nullable().default(null),
    period: z.enum(REPORT_PERIODS).default("yesterday"),
    custom_start: isoDate.nullable().default(null),
    custom_end: isoDate.nullable().default(null),
    body: z.string().trim().min(1, "Texto da parte é obrigatório").max(MAX_BODY_LENGTH),
    send_without_data: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => checkCustomRange(value, ctx));

const scheduleFields = {
  status: z.enum(REPORT_STATUSES),
  frequency: z.enum(REPORT_FREQUENCIES),
  send_time: sendTime,
  weekday: z.number().int().min(0).max(6).nullable(),
  month_day: z.number().int().min(1).max(31).nullable(),
  timezone: timeZone,
};

export const scheduleSchema = z.object(scheduleFields).superRefine(checkSchedule);

const nameField = z.string().trim().min(1, "Nome é obrigatório").max(120);
const partsField = z.array(reportPartSchema).min(1, "O relatório precisa de ao menos uma parte").max(MAX_PARTS);

export const createReportSchema = z
  .object({
    client_id: uuid,
    name: nameField,
    status: scheduleFields.status.default("draft"),
    frequency: scheduleFields.frequency.default("daily"),
    send_time: sendTime.default("08:00"),
    weekday: scheduleFields.weekday.default(null),
    month_day: scheduleFields.month_day.default(null),
    timezone: timeZone.default(DEFAULT_REPORT_TIMEZONE),
    parts: partsField,
  })
  .strict()
  .superRefine(checkSchedule);

export const updateReportSchema = z
  .object({
    client_id: uuid.optional(),
    name: nameField.optional(),
    status: scheduleFields.status.optional(),
    frequency: scheduleFields.frequency.optional(),
    send_time: sendTime.optional(),
    weekday: scheduleFields.weekday.optional(),
    month_day: scheduleFields.month_day.optional(),
    timezone: timeZone.optional(),
    parts: partsField.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nada para atualizar");

export const previewSchema = z
  .object({
    body: z.string().max(MAX_BODY_LENGTH),
    mode: z.enum(["preview", "live"]).default("preview"),
    period: z.enum(REPORT_PERIODS).default("yesterday"),
    customStart: isoDate.nullable().optional(),
    customEnd: isoDate.nullable().optional(),
    clientId: uuid.optional(),
    adAccountId: uuid.optional(),
    timezone: timeZone.default(DEFAULT_REPORT_TIMEZONE),
  })
  .strict()
  .superRefine((value, ctx) => {
    checkCustomRange(
      { period: value.period, custom_start: value.customStart, custom_end: value.customEnd },
      ctx,
      { start: "customStart", end: "customEnd" },
    );
    if (value.mode === "live" && !value.clientId && !value.adAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clientId"], message: "Modo live exige clientId ou adAccountId" });
    }
  });

export const deliverySchema = z
  .object({
    step: z.enum(DELIVERY_STEPS),
    note: z.string().trim().max(MAX_NOTE_LENGTH).optional(),
  })
  .strict();

export type ReportPartInput = z.infer<typeof reportPartSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type PreviewInput = z.infer<typeof previewSchema>;
export type DeliveryInput = z.infer<typeof deliverySchema>;
