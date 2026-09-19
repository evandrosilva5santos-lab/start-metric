import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function captureEvidence() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Logging into SaaS...");
  await page.goto("http://localhost:3000/auth", { waitUntil: "networkidle" });
  await page.fill('input[type="email"], #email', "evandrosilva.5santos@gmail.com");
  await page.fill('input[type="password"], #password', "Admin@2026!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);

  const outDir = "/Users/evandro/.gemini/antigravity-ide/brain/c7f5bd80-4848-417a-af4d-a9d5a2196c91/screenshots";
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1. Home
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, "saas_final_home.png"), fullPage: true });
  console.log("Captured: saas_final_home.png");

  // 2. Campaigns
  await page.goto("http://localhost:3000/campaigns", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, "saas_final_campaigns.png"), fullPage: true });
  console.log("Captured: saas_final_campaigns.png");

  // 3. Criativos
  await page.goto("http://localhost:3000/criativos", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, "saas_final_criativos.png"), fullPage: true });
  console.log("Captured: saas_final_criativos.png");

  // 4. Mobile Campaigns (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/campaigns", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, "saas_final_campaigns_mobile.png"), fullPage: true });
  console.log("Captured: saas_final_campaigns_mobile.png");

  await browser.close();
  console.log("All evidence captured successfully!");
}

captureEvidence().catch(console.error);
