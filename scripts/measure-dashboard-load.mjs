#!/usr/bin/env node

/**
 * scripts/measure-dashboard-load.mjs
 * Mede quanto tempo o painel leva, depois do login, para mostrar o cabeçalho
 * e o primeiro número em /performance. Roda duas vezes: primeira visita
 * (sem cópia local) e visita repetida (abre com os últimos números salvos).
 *
 * Uso:
 *   BASE_URL=https://seu-painel.vercel.app E2E_EMAIL=voce@exemplo.com E2E_PASSWORD=... \
 *     node scripts/measure-dashboard-load.mjs
 *
 * Opcional: RUNS=5 (repetições por cenário), CHROME=/caminho/do/chrome.
 */

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const RUNS = Number(process.env.RUNS ?? 5);

if (!EMAIL || !PASSWORD) {
  console.error("\x1b[31m[ERRO]\x1b[0m Defina E2E_EMAIL e E2E_PASSWORD.");
  process.exit(1);
}

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

async function login(context) {
  const page = await context.newPage();
  const startedAt = Date.now();
  await page.goto(`${BASE}/auth?next=/performance`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.locator('form button[type="submit"]').last().click();
  await page.locator("text=Receita atribuída >> visible=true").first().waitFor({ timeout: 60000 });
  const loginToFirstKpi = Date.now() - startedAt;
  await page.close();
  return loginToFirstKpi;
}

async function openPerformance(context) {
  const page = await context.newPage();
  const startedAt = Date.now();
  await page.goto(`${BASE}/performance`, { waitUntil: "commit" });
  const [header, firstKpi] = await Promise.all([
    page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 60000 }).then(() => Date.now() - startedAt),
    page.locator("text=Receita atribuída >> visible=true").first().waitFor({ timeout: 60000 }).then(() => Date.now() - startedAt),
  ]);
  await page.close();
  return { header, firstKpi };
}

const average = (values) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const firstVisit = [];
const repeatVisit = [];
const loginTimes = [];

for (let run = 0; run < RUNS; run += 1) {
  const context = await browser.newContext();
  loginTimes.push(await login(context));
  // Visita repetida: mesma sessão, a cópia local já existe.
  repeatVisit.push(await openPerformance(context));
  await context.close();

  // Primeira visita: sessão nova sem cópia local (login e depois abre direto).
  const fresh = await browser.newContext();
  await login(fresh);
  await fresh.addInitScript(() => {
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("sm:perf:"))
        .forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Sem armazenamento: nada a limpar.
    }
  });
  firstVisit.push(await openPerformance(fresh));
  await fresh.close();
}

await browser.close();

console.log(`\nPainel em ${BASE} · ${RUNS} repetições\n`);
console.table({
  "Login → primeiro número": { ms: average(loginTimes) },
  "Primeira visita · cabeçalho": { ms: average(firstVisit.map((r) => r.header)) },
  "Primeira visita · primeiro número": { ms: average(firstVisit.map((r) => r.firstKpi)) },
  "Visita repetida · primeiro número": { ms: average(repeatVisit.map((r) => r.firstKpi)) },
});
