// Puro (sem imports) para rodar também em `node --test`.

const MULTI_PART_SUFFIXES = new Set([
  "com.br", "net.br", "org.br", "gov.br", "edu.br", "art.br", "blog.br", "app.br", "ind.br", "eco.br", "adv.br", "med.br",
  "co.uk", "org.uk", "ac.uk", "me.uk",
  "com.au", "net.au", "org.au",
  "co.nz", "com.mx", "com.ar", "com.co", "com.pe", "com.pt", "co.jp", "co.za", "com.tr", "com.es",
  // Plataformas onde o subdomínio é o negócio
  "myshopify.com", "vercel.app", "netlify.app", "github.io", "web.app", "firebaseapp.com", "pages.dev",
  "wixsite.com", "wordpress.com", "blogspot.com", "carrd.co", "lojaintegrada.com.br", "nuvemshop.com.br",
]);

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Host em minúsculas, sem "www.", ou null quando não é um link http(s). */
export function hostnameOf(link: string | null | undefined): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(".")) return null;
  return host.startsWith("www.") ? host.slice(4) : host;
}

/** Domínio registrável ("loja.exemplo.com.br" → "exemplo.com.br"). */
export function registrableDomain(host: string | null | undefined): string | null {
  if (!host) return null;
  const clean = host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (IPV4.test(clean) || clean.includes(":")) return clean;
  const labels = clean.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  for (let take = Math.min(4, labels.length - 1); take >= 2; take--) {
    const suffix = labels.slice(-take).join(".");
    if (MULTI_PART_SUFFIXES.has(suffix)) return labels.slice(-(take + 1)).join(".");
  }
  return labels.slice(-2).join(".");
}

export function domainOfLink(link: string | null | undefined): string | null {
  return registrableDomain(hostnameOf(link));
}

/** Divergente = o domínio exibido no anúncio não é o domínio onde o link termina. */
export function isDivergent(displayed: string | null | undefined, resolved: string | null | undefined): boolean {
  const a = registrableDomain(displayed ? hostnameOf(displayed) ?? displayed : null);
  const b = registrableDomain(resolved ? hostnameOf(resolved) ?? resolved : null);
  if (!a || !b) return false;
  return a !== b;
}
