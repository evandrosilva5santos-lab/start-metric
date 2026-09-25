import "server-only";

import type { Ad, AdSource, SearchParams, SourceResult } from "./types";

const MAX_PAGES_PER_RUN = 25;
const NAV_TIMEOUT_MS = 45_000;

type RawCard = {
  adArchiveId: string;
  startedText: string | null;
  inactive: boolean;
  link: string | null;
  caption: string | null;
  mediaUrl: string | null;
  bodyText: string | null;
  cta: string | null;
  isVideo: boolean;
  pageName: string | null;
};

type BlockCheck = { blocked: boolean; reason: string | null };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ritmo lento e irregular entre páginas. */
function jitter(min: number, max: number) {
  return sleep(min + Math.random() * (max - min));
}

export function parseStartedText(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/(?:Started running on|Veiculação iniciada em)\s+(.+?)(?:\s*·|$)/i);
  if (!m) return null;
  const t = Date.parse(m[1].replace(/(\d)(st|nd|rd|th)/, "$1"));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function createScraperProprioSource(): AdSource {
  return {
    id: "scraper_proprio",
    async search(params: SearchParams): Promise<SourceResult> {
      const pageIds = (params.pageIds ?? []).slice(0, MAX_PAGES_PER_RUN);
      if (pageIds.length === 0) return { ads: [], status: "ok", message: "Nenhuma oferta vigiada.", completedPageIds: [] };

      let playwright: typeof import("playwright");
      try {
        playwright = await import("playwright");
      } catch {
        return { ads: [], status: "unavailable", message: "Scraper indisponível neste ambiente (Playwright não instalado)." };
      }

      let browser: Awaited<ReturnType<typeof playwright.chromium.launch>>;
      try {
        browser = await playwright.chromium.launch({ headless: true });
      } catch {
        return { ads: [], status: "unavailable", message: "Scraper indisponível neste ambiente (navegador não inicia)." };
      }

      const ads: Ad[] = [];
      const completedPageIds: string[] = [];
      try {
        const context = await browser.newContext({
          locale: "en-US",
          timezoneId: "UTC",
          viewport: { width: 1280, height: 900 },
        });
        const page = await context.newPage();
        const hasher = await context.newPage();

        for (const pageId of pageIds) {
          const url = new URL("https://www.facebook.com/ads/library/");
          url.search = new URLSearchParams({
            active_status: "active",
            ad_type: "all",
            country: params.country ? params.country.toUpperCase() : "ALL",
            view_all_page_id: pageId,
            search_type: "page",
            media_type: "all",
          }).toString();

          await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
          await jitter(2500, 4500);

          const check = await detectBlock(page);
          if (check.blocked) {
            return { ads, status: "blocked", message: check.reason ?? "A Meta bloqueou a leitura.", completedPageIds };
          }

          for (let i = 0; i < 4; i++) {
            await page.mouse.wheel(0, 2400);
            await jitter(1200, 2200);
          }

          const cards = await page.evaluate(extractCards);
          for (const card of cards) {
            let pixelHash: string | null = null;
            if (card.mediaUrl) pixelHash = await dHashFromImage(page, hasher, card.adArchiveId);
            ads.push({
              adArchiveId: card.adArchiveId,
              pageId,
              pageName: card.pageName,
              startedAt: parseStartedText(card.startedText),
              isActive: !card.inactive,
              link: card.link,
              displayedDomain: card.caption?.toLowerCase() ?? null,
              mediaUrl: card.mediaUrl,
              bodyText: card.bodyText,
              cta: card.cta,
              format: card.isVideo ? "video" : card.mediaUrl ? "image" : null,
              pixelHash,
            });
          }
          completedPageIds.push(pageId);
          await jitter(4000, 8000);
        }
        return { ads, status: "ok", completedPageIds };
      } catch (e) {
        return {
          ads,
          status: ads.length ? "blocked" : "error",
          message: e instanceof Error ? `Leitura interrompida: ${e.message.slice(0, 180)}` : "Leitura interrompida.",
          completedPageIds,
        };
      } finally {
        await browser.close().catch(() => undefined);
      }
    },
  };
}

type PwPage = import("playwright").Page;

async function detectBlock(page: PwPage): Promise<BlockCheck> {
  const current = page.url();
  if (/\/login|\/checkpoint|\/two_step_verification/.test(current)) {
    return { blocked: true, reason: "A Meta pediu login para abrir a Biblioteca de Anúncios." };
  }
  const signals = await page.evaluate(() => {
    const text = document.body?.innerText?.slice(0, 5000) ?? "";
    return {
      loginForm: !!document.querySelector('form[action*="login"] input[name="email"], #login_form'),
      captcha: !!document.querySelector('iframe[src*="captcha"], iframe[title*="captcha" i], #captcha'),
      text,
    };
  });
  if (signals.captcha || /security check|verificação de segurança|confirm you'?re human/i.test(signals.text)) {
    return { blocked: true, reason: "A Meta mostrou um captcha / verificação de segurança." };
  }
  if (signals.loginForm && !/Library ID|Identificação da biblioteca/i.test(signals.text)) {
    return { blocked: true, reason: "A Meta pediu login para abrir a Biblioteca de Anúncios." };
  }
  if (/temporarily blocked|you'?re temporarily|bloqueado temporariamente|rate limit/i.test(signals.text)) {
    return { blocked: true, reason: "A Meta bloqueou temporariamente as leituras deste servidor." };
  }
  return { blocked: false, reason: null };
}

// Roda dentro do navegador: não pode usar nada do escopo do módulo.
function extractCards(): RawCard[] {
  const out: RawCard[] = [];
  const seen = new Set<string>();
  const idPattern = /(?:Library ID|Identificação da biblioteca|ID da biblioteca):\s*(\d{6,})/i;
  const all = Array.from(document.querySelectorAll("div, span"));
  for (const el of all) {
    if (el.children.length > 0) continue;
    const m = (el.textContent ?? "").match(idPattern);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    let card: HTMLElement | null = el as HTMLElement;
    for (let i = 0; i < 12 && card; i++) {
      if (card.querySelector("img, video") && (card.innerText ?? "").length > 80) break;
      card = card.parentElement;
    }
    if (!card) continue;
    card.setAttribute("data-garimpo-id", m[1]);
    const text = card.innerText ?? "";
    const started = text.split("\n").find((l) => /Started running on|Veiculação iniciada em/i.test(l)) ?? null;
    const anchor = Array.from(card.querySelectorAll("a[href]"))
      .map((a) => (a as HTMLAnchorElement).href)
      .find((h) => h.includes("l.facebook.com/l.php") || (!h.includes("facebook.com") && /^https?:/.test(h)));
    const img = Array.from(card.querySelectorAll("img"))
      .map((i) => i as HTMLImageElement)
      .find((i) => i.naturalWidth >= 120 || i.width >= 120);
    const video = card.querySelector("video") as HTMLVideoElement | null;
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const caption = lines.find((l) => /^[A-Z0-9.-]+\.[A-Z]{2,}$/.test(l)) ?? null;
    const body = lines.filter((l) => l.length > 40 && !idPattern.test(l)).sort((a, b) => b.length - a.length)[0] ?? null;
    const sponsoredIdx = lines.findIndex((l) => /^Sponsored$|^Patrocinado$/i.test(l));
    out.push({
      adArchiveId: m[1],
      startedText: started,
      inactive: /\bInactive\b|\bInativo\b/.test(text),
      link: anchor ?? null,
      caption,
      mediaUrl: video?.poster || img?.src || null,
      bodyText: body,
      cta: lines.find((l) => /^(Learn more|Shop now|Sign up|Saiba mais|Comprar agora|Cadastre-se|Send message|Enviar mensagem)$/i.test(l)) ?? null,
      isVideo: !!video,
      pageName: sponsoredIdx > 0 ? lines[sponsoredIdx - 1] : null,
    });
  }
  return out;
}

/** dHash 64 bits a partir dos pixels do criativo na tela (screenshot → canvas 9×8 em tons de cinza). */
async function dHashFromImage(page: PwPage, hasher: PwPage, adArchiveId: string): Promise<string | null> {
  try {
    const handle = await page.$(`[data-garimpo-id="${adArchiveId}"] img, [data-garimpo-id="${adArchiveId}"] video`);
    if (!handle) return null;
    const png = await handle.screenshot({ type: "png", timeout: 5000 });
    return await hasher.evaluate(async (b64: string) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 9;
      canvas.height = 8;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, 9, 8);
      const px = ctx.getImageData(0, 0, 9, 8).data;
      const gray = (x: number, y: number) => {
        const i = (y * 9 + x) * 4;
        return px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      };
      let bits = "";
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray(x, y) > gray(x + 1, y) ? "1" : "0";
      let hex = "";
      for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
      return hex;
    }, png.toString("base64"));
  } catch {
    return null;
  }
}
