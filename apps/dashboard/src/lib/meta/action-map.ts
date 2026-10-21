export type ActionMap = Record<string, number>;

export interface GraphActionEntry {
  action_type?: string | null;
  value?: string | number | null;
}

export function toActionMap(entries: readonly GraphActionEntry[] | null | undefined): ActionMap {
  if (!Array.isArray(entries)) return {};

  return entries.reduce<ActionMap>((acc, entry) => {
    const key = typeof entry?.action_type === "string" ? entry.action_type.trim() : "";
    if (!key) return acc;

    const value = typeof entry.value === "number" ? entry.value : Number.parseFloat(String(entry.value ?? ""));
    if (!Number.isFinite(value)) return acc;

    const previous = Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : 0;
    return { ...acc, [key]: previous + value };
  }, {});
}
