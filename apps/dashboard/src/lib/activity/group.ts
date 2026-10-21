// Itens de trabalho por rajada: mesmo ator + mesma ação, com no máximo 5 min entre eventos,
// em qualquer conjunto ou campanha. Uma pausa em massa vira um item, não centenas de linhas.

export const BURST_GAP_MS = 5 * 60_000;

export type Burstable = { occurredAt: string; actorKey: string; action: string };
export type Burst<T extends Burstable> = { first: T; events: T[]; startedAt: string; endedAt: string };

/** Devolve as rajadas da mais recente para a mais antiga; dentro de cada uma, eventos em ordem cronológica. */
export function groupBursts<T extends Burstable>(events: readonly T[], gapMs = BURST_GAP_MS): Burst<T>[] {
  const ordered = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const bursts: Burst<T>[] = [];
  const open = new Map<string, { burst: Burst<T>; lastAt: number }>();

  for (const event of ordered) {
    const key = `${event.actorKey}|${event.action}`;
    const at = Date.parse(event.occurredAt);
    const current = open.get(key);
    if (current && at - current.lastAt <= gapMs) {
      current.burst.events.push(event);
      current.burst.endedAt = event.occurredAt;
      current.lastAt = at;
      continue;
    }
    const burst: Burst<T> = { first: event, events: [event], startedAt: event.occurredAt, endedAt: event.occurredAt };
    bursts.push(burst);
    open.set(key, { burst, lastAt: at });
  }

  return bursts.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
