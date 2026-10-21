"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, errorMessage, reportsApi } from "../api";
import type { PreviewResult } from "../types";
import type { PartDraft } from "./draft";

export const LIVE_DEBOUNCE_MS = 900;
const DEFAULT_RETRY_SECONDS = 60;

export type LivePart =
  | { state: "pending" }
  | { state: "ready"; result: PreviewResult }
  | { state: "error"; message: string };

interface LiveInput {
  parts: readonly PartDraft[];
  clientId: string;
  timezone: string;
  enabled: boolean;
}

export interface LivePreview {
  byKey: Record<string, LivePart>;
  isLoading: boolean;
  rateLimit: { message: string; until: number } | null;
}

function signatureOf(part: PartDraft, clientId: string, timezone: string): string {
  return JSON.stringify([part.body, part.period, part.custom_start, part.custom_end, part.ad_account_id, clientId, timezone]);
}

function incompleteReason(part: PartDraft): string | null {
  if (!part.body.trim()) return "Parte sem texto.";
  if (part.period === "custom" && (!part.custom_start || !part.custom_end || part.custom_start > part.custom_end)) {
    return "Complete o período personalizado para ver os dados reais.";
  }
  return null;
}

function retrySeconds(message: string): number {
  const match = /(\d+)\s*s\b/.exec(message);
  return match ? Number(match[1]) : DEFAULT_RETRY_SECONDS;
}

export function useLivePreview({ parts, clientId, timezone, enabled }: LiveInput): LivePreview {
  const doneRef = useRef(new Set<string>());
  const [results, setResults] = useState<Record<string, LivePart>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimit, setRateLimit] = useState<LivePreview["rateLimit"]>(null);

  const jobs = useMemo(
    () => parts.map((part) => ({ part, signature: signatureOf(part, clientId, timezone), reason: incompleteReason(part) })),
    [parts, clientId, timezone],
  );

  useEffect(() => {
    if (!enabled || !clientId || rateLimit) return;
    const pending = jobs.filter((j) => !j.reason && !doneRef.current.has(j.signature));
    if (pending.length === 0) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      for (const job of pending) {
        if (controller.signal.aborted) break;
        let outcome: LivePart;
        try {
          const result = await reportsApi.previewLive(
            {
              body: job.part.body,
              period: job.part.period,
              customStart: job.part.custom_start || null,
              customEnd: job.part.custom_end || null,
              clientId,
              adAccountId: job.part.ad_account_id,
              timezone,
            },
            controller.signal,
          );
          outcome = { state: "ready", result };
          doneRef.current.add(job.signature);
        } catch (err) {
          if (controller.signal.aborted) break;
          if (err instanceof ApiError && err.status === 429) {
            setRateLimit({ message: err.message, until: Date.now() + retrySeconds(err.message) * 1000 });
            break;
          }
          outcome = { state: "error", message: errorMessage(err) };
        }
        setResults((prev) => ({ ...prev, [job.signature]: outcome }));
      }
      if (!controller.signal.aborted) setIsLoading(false);
    }, LIVE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setIsLoading(false);
    };
  }, [enabled, clientId, timezone, jobs, rateLimit]);

  useEffect(() => {
    if (!rateLimit) return;
    const timer = setTimeout(() => setRateLimit(null), Math.max(rateLimit.until - Date.now(), 0));
    return () => clearTimeout(timer);
  }, [rateLimit]);

  const byKey = useMemo(
    () =>
      Object.fromEntries(
        jobs.map(({ part, signature, reason }): [string, LivePart] => [
          part.key,
          reason ? { state: "error", message: reason } : (results[signature] ?? { state: "pending" }),
        ]),
      ),
    [jobs, results],
  );

  return { byKey, isLoading, rateLimit };
}
