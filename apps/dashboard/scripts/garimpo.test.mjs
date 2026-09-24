// Rodar de apps/dashboard: node --test scripts/garimpo.test.mjs (Node 22.18+ remove os tipos do .ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { hostnameOf, registrableDomain, domainOfLink, isDivergent } from "../src/lib/garimpo/domain.ts";
import { computeSignals, scoreOffer, passesCut, DEFAULT_CUT } from "../src/lib/garimpo/score.ts";

test("hostnameOf normaliza e recusa esquemas não-http", () => {
  assert.equal(hostnameOf("https://WWW.Exemplo.com.br/oferta?x=1"), "exemplo.com.br");
  assert.equal(hostnameOf("exemplo.com"), "exemplo.com");
  assert.equal(hostnameOf("javascript:alert(1)"), null);
  assert.equal(hostnameOf("ftp://exemplo.com"), null);
  assert.equal(hostnameOf(""), null);
  assert.equal(hostnameOf(null), null);
});

test("registrableDomain respeita sufixos compostos", () => {
  assert.equal(registrableDomain("loja.exemplo.com.br"), "exemplo.com.br");
  assert.equal(registrableDomain("a.b.exemplo.com"), "exemplo.com");
  assert.equal(registrableDomain("shop.exemplo.co.uk"), "exemplo.co.uk");
  assert.equal(registrableDomain("minha-loja.myshopify.com"), "minha-loja.myshopify.com");
  assert.equal(registrableDomain("10.0.0.1"), "10.0.0.1");
  assert.equal(registrableDomain("localhost"), null);
  assert.equal(domainOfLink("https://pay.exemplo.com.br/checkout"), "exemplo.com.br");
});

test("isDivergent compara domínios registráveis", () => {
  assert.equal(isDivergent("exemplo.com.br", "https://lp.exemplo.com.br/x"), false);
  assert.equal(isDivergent("noticias-saude.com", "https://oferta-real.com/vsl"), true);
  assert.equal(isDivergent(null, "https://oferta-real.com"), false);
});

const now = new Date("2026-09-24T12:00:00Z");
const daysAgo = (d) => new Date(now.getTime() - d * 86_400_000).toISOString();

test("computeSignals: longevidade, aceleração e blindagem", () => {
  const s = computeSignals(
    [
      { pageKey: "p1", startedAt: daysAgo(40), isActive: true, creativeHash: "h1", format: "video" },
      { pageKey: "p2", startedAt: daysAgo(3), isActive: true, creativeHash: "h1", format: "video" },
      { pageKey: "p3", startedAt: daysAgo(2), isActive: true, creativeHash: "h1", format: "image" },
      { pageKey: "p3", startedAt: daysAgo(90), isActive: false, creativeHash: "h2" },
    ],
    now,
  );
  assert.equal(s.activeAds, 3);
  assert.equal(s.totalAds, 4);
  assert.equal(s.pageCount, 3);
  assert.equal(s.oldestActiveDays, 40);
  assert.equal(s.new14d, 2);
  assert.equal(s.repeatedCreatives, 1);
  assert.equal(s.pagesWithRepeatedCreative, 3);
  assert.deepEqual(s.formats, ["image", "video"]);
});

test("computeSignals: sem datas é ausência (null), não zero", () => {
  const s = computeSignals([{ pageKey: "p1", startedAt: null, isActive: true, creativeHash: null }], now);
  assert.equal(s.oldestActiveDays, null);
  assert.equal(s.new14d, null);
});

test("scoreOffer: blindagem + aceleração vencem volume puro", () => {
  const bigBrand = computeSignals(
    Array.from({ length: 60 }, (_, i) => ({ pageKey: "marca", startedAt: daysAgo(200 + i), isActive: true, creativeHash: `m${i}` })),
    now,
  );
  const scaling = computeSignals(
    Array.from({ length: 8 }, (_, i) => ({ pageKey: `p${i % 4}`, startedAt: daysAgo(i < 6 ? 5 : 25), isActive: true, creativeHash: "igual" })),
    now,
  );
  const a = scoreOffer(bigBrand);
  const b = scoreOffer(scaling);
  assert.ok(b > a, `escalando (${b}) deveria superar marca grande (${a})`);
  assert.ok(a >= 0 && a <= 100 && b >= 0 && b <= 100);
  assert.equal(scoreOffer(computeSignals([], now)), 0);
});

test("passesCut", () => {
  const s = computeSignals(
    Array.from({ length: 6 }, (_, i) => ({ pageKey: `p${i % 2}`, startedAt: daysAgo(10), isActive: true, creativeHash: null, format: "video" })),
    now,
  );
  assert.equal(passesCut(s, DEFAULT_CUT), true);
  assert.equal(passesCut(s, { ...DEFAULT_CUT, minPages: 3 }), false);
  assert.equal(passesCut(s, { ...DEFAULT_CUT, formats: ["image"] }), false);
  assert.equal(passesCut(s, { ...DEFAULT_CUT, minDays: 30 }), false);
});
