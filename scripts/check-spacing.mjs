import { chromium } from "playwright";
import path from "node:path";

async function checkSpacing() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Logging into SaaS...");
  await page.goto("http://localhost:3000/auth", { waitUntil: "networkidle" });
  await page.fill('input[type="email"], #email', "evandrosilva.5santos@gmail.com");
  await page.fill('input[type="password"], #password', "Admin@2026!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  const outDir = "/Users/evandro/.gemini/antigravity-ide/brain/c7f5bd80-4848-417a-af4d-a9d5a2196c91/screenshots";

  // 1. Settings (Integrações)
  await page.goto("http://localhost:3000/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, "saas_settings_fixed_spacing.png"), fullPage: true });
  console.log("Captured: saas_settings_fixed_spacing.png");

  // 2. Settings Meta
  await page.goto("http://localhost:3000/settings/meta", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, "saas_settings_meta_fixed_spacing.png"), fullPage: true });
  console.log("Captured: saas_settings_meta_fixed_spacing.png");

  await browser.close();
  console.log("Spacing check completed!");
}

checkSpacing().catch(console.error);
