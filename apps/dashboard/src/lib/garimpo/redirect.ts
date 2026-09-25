import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { hostnameOf, isDivergent, registrableDomain } from "./domain";

export type RedirectResult = {
  chain: string[];
  finalUrl: string | null;
  resolvedDomain: string | null;
  divergent: boolean;
  error: string | null;
};

const MAX_HOPS = 8;
const HOP_TIMEOUT_MS = 5_000;
const USER_AGENT = "Mozilla/5.0 (compatible; StartMetricGarimpo/1.0)";

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (lower === "::" || lower === "::1") return true;
    if (/^f[cd]/.test(lower)) return true;
    if (/^fe[89ab]/.test(lower)) return true;
    if (lower.startsWith("ff")) return true;
    if (lower.startsWith("64:ff9b:")) return true;
    return false;
  }
  return true;
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocolo não permitido");
  if (url.username || url.password) throw new Error("link com credenciais");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("porta não permitida");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("endereço interno bloqueado");
    return;
  }
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("endereço interno bloqueado");
  }
}

/** Tira o "l.facebook.com/l.php?u=" que embrulha links de anúncio. */
export function unwrapFacebookShim(link: string): string {
  try {
    const url = new URL(link);
    if (/(^|\.)facebook\.com$/.test(url.hostname) && url.pathname === "/l.php") {
      return url.searchParams.get("u") ?? link;
    }
  } catch {
    return link;
  }
  return link;
}

/** Segue os redirecionamentos no servidor, um salto por vez, recusando destinos internos. */
export async function resolveRedirects(rawLink: string, displayedDomain: string | null = null): Promise<RedirectResult> {
  const start = unwrapFacebookShim(rawLink.trim());
  const chain: string[] = [];
  let current: URL;
  try {
    current = new URL(/^https?:\/\//i.test(start) ? start : `https://${start}`);
  } catch {
    return { chain, finalUrl: null, resolvedDomain: null, divergent: false, error: "link inválido" };
  }

  let error: string | null = null;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    chain.push(current.toString());
    if (hop === MAX_HOPS) {
      error = "redirecionamentos demais";
      break;
    }
    try {
      await assertPublicUrl(current);
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
        cache: "no-store",
      });
      await res.body?.cancel().catch(() => undefined);
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current);
        continue;
      }
      break;
    } catch (e) {
      error = e instanceof Error ? e.message : "falha ao seguir o link";
      break;
    }
  }

  const finalUrl = chain[chain.length - 1] ?? null;
  const resolvedDomain = registrableDomain(hostnameOf(finalUrl));
  const displayed = displayedDomain ?? hostnameOf(chain[0]);
  return {
    chain,
    finalUrl,
    resolvedDomain,
    divergent: isDivergent(displayed, resolvedDomain),
    error,
  };
}
