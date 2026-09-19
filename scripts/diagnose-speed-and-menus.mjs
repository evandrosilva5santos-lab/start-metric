import { chromium } from "playwright";

async function runDiagnosis() {
  console.log("🚀 Starting Full Diagnosis: Speed & Menus...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on("console", (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    consoleLogs.push(`[PAGE_ERROR] ${err.message}`);
  });

  const measurements = [];

  async function measurePage(name, url) {
    const t0 = Date.now();
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      const domTime = Date.now() - t0;
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      const fullTime = Date.now() - t0;
      const status = response ? response.status() : "no-response";
      measurements.push({ name, url, status, domTime, fullTime });
      console.log(`✅ ${name} (${url}): Status ${status} | DOM: ${domTime}ms | Full: ${fullTime}ms`);
    } catch (e) {
      measurements.push({ name, url, error: e.message, time: Date.now() - t0 });
      console.log(`❌ ${name} (${url}): Error ${e.message}`);
    }
  }

  // 1. Check Login
  console.log("\n--- Checking Auth & Login ---");
  await page.goto("http://localhost:3000/auth", { waitUntil: "networkidle" });
  await page.fill('input[type="email"], #email', "evandrosilva.5santos@gmail.com");
  await page.fill('input[type="password"], #password', "Admin@2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 15000 }).catch(() => {});
  console.log("Logged in, current URL:", page.url());

  // 2. Measure all routes
  const routes = [
    { name: "Dashboard (Home)", url: "http://localhost:3000/" },
    { name: "Campanhas (Split-View)", url: "http://localhost:3000/campaigns" },
    { name: "Criativos", url: "http://localhost:3000/criativos" },
    { name: "Clientes", url: "http://localhost:3000/clients" },
    { name: "Relatórios", url: "http://localhost:3000/reports" },
    { name: "Configurações", url: "http://localhost:3000/settings" },
    { name: "Perfil", url: "http://localhost:3000/settings/profile" },
    { name: "Contas Meta", url: "http://localhost:3000/settings/meta" },
  ];

  console.log("\n--- Measuring Page Speed ---");
  for (const r of routes) {
    await measurePage(r.name, r.url);
  }

  // 3. Test Sidebar Navigation clicks
  console.log("\n--- Testing Sidebar Menu Clicks ---");
  const sidebarLinks = await page.$$("aside nav a");
  console.log(`Found ${sidebarLinks.length} sidebar links.`);
  for (let i = 0; i < sidebarLinks.length; i++) {
    const link = (await page.$$("aside nav a"))[i];
    const text = await link.innerText();
    const href = await link.getAttribute("href");
    console.log(`Clicking [${text.replace(/\n/g, " - ")}] -> ${href}`);
    const t0 = Date.now();
    await link.click();
    await page.waitForTimeout(1000);
    console.log(`  Navigated to: ${page.url()} in ${Date.now() - t0}ms`);
  }

  // 4. Test Mobile Menu
  console.log("\n--- Testing Mobile Viewport & Menu ---");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  const menuBtn = await page.$('button[aria-label*="menu" i], button[aria-label*="navegação" i]');
  if (menuBtn) {
    console.log("Clicking mobile menu button...");
    await menuBtn.click();
    await page.waitForTimeout(500);
    const mobileLinks = await page.$$("#mobile-nav a");
    console.log(`Mobile menu opened! Found ${mobileLinks.length} mobile links.`);
    for (const mLink of mobileLinks) {
      const text = await mLink.innerText();
      const href = await mLink.getAttribute("href");
      console.log(`  Mobile link: ${text} -> ${href}`);
    }
  } else {
    console.log("⚠️ Mobile menu button not found!");
  }

  console.log("\n--- Console Logs / Errors ---");
  const errors = consoleLogs.filter((l) => l.includes("error") || l.includes("PAGE_ERROR") || l.includes("Failed"));
  if (errors.length > 0) {
    console.log(`Found ${errors.length} error logs:`);
    errors.forEach((e) => console.log("  ", e));
  } else {
    console.log("✨ Zero console errors detected!");
  }

  await browser.close();
  console.log("\n🏁 Diagnosis complete!");
}

runDiagnosis().catch(console.error);
