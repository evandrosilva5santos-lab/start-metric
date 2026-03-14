"use client";

export type TrackingEventName =
  | "page_view"
  | "add_to_cart"
  | "checkout_start"
  | "purchase"
  | "custom";

export type TrackEventInput = {
  eventName: TrackingEventName;
  eventId?: string;
  pageUrl?: string;
  referrer?: string;
  value?: number;
  currency?: string;
  payload?: Record<string, unknown>;
};

type AttributionData = {
  utm_source?: string;
  utm_campaign?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
};

const TRACKING_ENDPOINT = "/api/tracking/events";
const SESSION_KEY = "sm_session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "";

  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function readAttribution(search: URLSearchParams): AttributionData {
  const pick = (key: string): string | undefined => {
    const value = search.get(key)?.trim();
    return value ? value : undefined;
  };

  return {
    utm_source: pick("utm_source"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    gclid: pick("gclid"),
    fbclid: pick("fbclid"),
    ttclid: pick("ttclid"),
  };
}

export async function trackEvent(input: TrackEventInput): Promise<void> {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const attribution = readAttribution(url.searchParams);

  const body = {
    event_id: input.eventId ?? window.crypto.randomUUID(),
    event_name: input.eventName,
    event_time: new Date().toISOString(),
    session_id: getSessionId(),
    page_url: input.pageUrl ?? url.toString(),
    referrer: (input.referrer ?? document.referrer) || undefined,
    ...attribution,
    value: input.value,
    currency: input.currency,
    payload: input.payload ?? {},
  };

  try {
    await fetch(TRACKING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Tracking falhas nao devem quebrar a UX.
  }
}
