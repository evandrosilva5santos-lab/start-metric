const PAINEL_SENHA = process.env.PAINEL_SENHA || process.env.DASHBOARD_PASSWORD || "";
export const PAINEL_COOKIE_NAME = "painel_session";

export async function hashPassword(pass: string): Promise<string> {
  const enc = new TextEncoder().encode(pass);
  const hashBuf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isPainelAuthorized(
  cookieValue?: string | null,
): Promise<boolean> {
  if (!cookieValue) return false;
  if (!PAINEL_SENHA) {
    // Se não há senha configurada em ambiente de desenvolvimento, aceita dev_authorized
    return process.env.NODE_ENV !== "production" && cookieValue === "dev_authorized";
  }

  const expectedHash = await hashPassword(PAINEL_SENHA);
  return cookieValue === expectedHash;
}

export function hasPasswordConfigured(): boolean {
  return Boolean(PAINEL_SENHA);
}
