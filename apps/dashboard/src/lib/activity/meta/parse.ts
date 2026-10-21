// Leitura sem perdas das respostas da Graph API.
// A Meta envia ids de 64 bits como número JSON (ex.: campaign_id dentro de extra_data);
// JSON.parse comum arredonda esses valores. O reviver usa o texto original do número.

type ReviverContext = { source?: string };

const INTEGER = /^-?\d+$/;

function keepBigIntegers(_key: string, value: unknown, context?: ReviverContext): unknown {
  if (typeof value !== "number" || Number.isSafeInteger(value)) return value;
  const source = context?.source;
  return source && INTEGER.test(source) ? source : value;
}

const parseLossless = (text: string): unknown =>
  JSON.parse(text, keepBigIntegers as (this: unknown, key: string, value: unknown) => unknown);

export function parseGraphText<T = unknown>(text: string): T {
  return parseLossless(text) as T;
}

export function parseExtraData(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed = parseLossless(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
