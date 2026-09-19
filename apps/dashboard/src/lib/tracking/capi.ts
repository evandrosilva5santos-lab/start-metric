import { createHash } from "node:crypto";

export interface MetaCapiUserData {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
}

export interface MetaCapiCustomData {
  currency?: string;
  value?: number;
  orderId?: string;
  contentName?: string;
  contentType?: string;
  numItems?: number;
  [key: string]: unknown;
}

export interface MetaCapiEventPayload {
  eventName: "Purchase" | "Lead" | "CompleteRegistration" | "Schedule" | "AddToCart" | "InitiateCheckout" | string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: "website" | "email" | "system_generated" | "other";
  eventId?: string;
  userData: MetaCapiUserData;
  customData?: MetaCapiCustomData;
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D+/g, "");
  if (digits.length <= 11 && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return digits;
}

export function formatUserDataForCapi(data: MetaCapiUserData): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};

  if (data.email) {
    formatted.em = [sha256(data.email)];
  }

  if (data.phone) {
    formatted.ph = [sha256(normalizePhone(data.phone))];
  }

  if (data.firstName) {
    formatted.fn = [sha256(data.firstName)];
  }

  if (data.lastName) {
    formatted.ln = [sha256(data.lastName)];
  }

  if (data.clientIpAddress) {
    formatted.client_ip_address = data.clientIpAddress;
  }

  if (data.clientUserAgent) {
    formatted.client_user_agent = data.clientUserAgent;
  }

  if (data.fbc) {
    formatted.fbc = data.fbc;
  }

  if (data.fbp) {
    formatted.fbp = data.fbp;
  }

  return formatted;
}

/**
 * Envia um evento de conversão server-side diretamente para a Meta Graph API (Conversions API)
 */
export async function sendMetaCapiEvent({
  pixelId,
  accessToken,
  testEventCode,
  event,
}: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  event: MetaCapiEventPayload;
}): Promise<{ success: boolean; eventsReceived?: number; error?: string }> {
  const url = `https://graph.facebook.com/v21.0/${pixelId}/events`;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        event_source_url: event.eventSourceUrl,
        action_source: event.actionSource || "website",
        event_id: event.eventId,
        user_data: formatUserDataForCapi(event.userData),
        custom_data: event.customData,
      },
    ],
    access_token: accessToken,
  };

  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
      return {
        success: false,
        error: json.error?.message || `Meta CAPI error ${res.status}`,
      };
    }

    return {
      success: true,
      eventsReceived: json.events_received ?? 1,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { success: false, error: msg };
  }
}
