export function readBodyObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

export function getTrimmedString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function optionalTrimmedString(value: unknown): string | null {
  const trimmed = getTrimmedString(value);
  return trimmed.length > 0 ? trimmed : null;
}

export function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function integerOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : null;
}

export function safeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function normalizePlanCode(code: string, fallbackName: string): string {
  const source = (code || fallbackName).trim().toLowerCase();
  return source
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
