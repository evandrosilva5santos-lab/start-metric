// Conta de serviço do Google: monta a asserção JWT (RS256) trocada por um access token com escopo adwords.
// Módulo puro: não faz rede; a troca fica em google-ads/client.ts.

import { createSign } from "node:crypto";

export const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const LIFETIME_SECONDS = 3600;

export type ServiceAccount = { clientEmail: string; privateKey: string; tokenUri: string };

export function parseServiceAccount(json: string): ServiceAccount {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("conta de serviço inválida: JSON ilegível");
  }
  const clientEmail = data.client_email;
  const privateKey = data.private_key;
  if (data.type !== "service_account" || typeof clientEmail !== "string" || typeof privateKey !== "string") {
    throw new Error("conta de serviço inválida: faltam type, client_email ou private_key");
  }
  const tokenUri = typeof data.token_uri === "string" ? data.token_uri : DEFAULT_TOKEN_URI;
  return { clientEmail, privateKey, tokenUri };
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function buildServiceAccountAssertion(sa: ServiceAccount, nowSeconds: number): string {
  const header = encode({ alg: "RS256", typ: "JWT" });
  const payload = encode({
    iss: sa.clientEmail,
    scope: ADWORDS_SCOPE,
    aud: sa.tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + LIFETIME_SECONDS,
  });
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(sa.privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}
