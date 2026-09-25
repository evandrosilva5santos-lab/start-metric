import "server-only";

import { createHash } from "node:crypto";

export type HashKind = "phash" | "fingerprint";

export type CreativeHash = { hash: string; kind: HashKind } | null;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mediaBasename(url: string): string | null {
  try {
    const name = new URL(url).pathname.split("/").filter(Boolean).pop();
    return name ? name.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Hash do criativo. Com pixels (scraper próprio) usa o dHash perceptual.
 * Sem pixels (API oficial, Apify) cai numa impressão digital de texto + nome do
 * arquivo: sinal mais fraco, porque a mesma peça reenviada muda de nome.
 */
export function creativeHashFor(ad: { pixelHash?: string | null; bodyText: string | null; mediaUrl: string | null }): CreativeHash {
  if (ad.pixelHash) return { hash: `p:${ad.pixelHash}`, kind: "phash" };
  const text = ad.bodyText ? normalizeText(ad.bodyText) : "";
  const basis = text.length >= 20 ? `t:${text}` : ad.mediaUrl ? `m:${mediaBasename(ad.mediaUrl) ?? ""}|${text}` : text ? `t:${text}` : "";
  if (!basis || basis === "m:|") return null;
  return { hash: `f:${createHash("sha256").update(basis).digest("hex").slice(0, 32)}`, kind: "fingerprint" };
}

/** Só guardamos mídia de CDNs que a CSP do painel já permite. */
export function safeMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (!/(^|\.)fbcdn\.net$/.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}
