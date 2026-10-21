// Chave de deduplicação dos eventos da Meta (a API não tem id de evento).
// A assinatura usa só campos estáveis entre buscas: códigos, valores, ids e nomes.
// Ficam de fora URLs assinadas, listas de direcionamento e textos traduzidos.
// Eventos idênticos no mesmo segundo recebem ordinais 0, 1, 2…

import { createHash } from "node:crypto";
import type { ActivityValue, NormalizedActivity } from "../types";

export const DEDUPE_VERSION = 1;

function stableValue(value: ActivityValue | null): unknown {
  if (!value) return null;
  if ("amountMinor" in value) return [value.amountMinor, value.currency, value.period];
  if ("statusCode" in value) return value.statusCode ?? value.label;
  if ("items" in value) return null;
  if ("name" in value) return value.name;
  if ("start" in value) return [value.start, value.stop];
  return value.value;
}

function baseKey(n: NormalizedActivity): string {
  const signature = createHash("sha1")
    .update(JSON.stringify([n.eventType, n.objectExternalId, stableValue(n.before), stableValue(n.after)]))
    .digest("hex")
    .slice(0, 16);
  const seconds = Math.floor(Date.parse(n.occurredAt) / 1000);
  return `meta:v${DEDUPE_VERSION}:${n.accountExternalId}:${seconds}:${n.eventType}:${n.objectExternalId ?? "-"}:${signature}`;
}

/** Deve receber uma janela inteira: eventos do mesmo segundo precisam estar juntos para o ordinal ser estável. */
export function assignDedupeKeys<T extends NormalizedActivity>(window: readonly T[]): Array<T & { dedupeKey: string }> {
  const seen = new Map<string, number>();
  return window.map((n) => {
    const base = baseKey(n);
    const ordinal = seen.get(base) ?? 0;
    seen.set(base, ordinal + 1);
    return { ...n, dedupeKey: `${base}:${ordinal}` };
  });
}
