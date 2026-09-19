import { chromium } from "playwright";
import path from "node:path";

async function verifyCreatives() {
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

  // Criativos
  await page.goto("http://localhost:3000/criativos", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(outDir, "saas_criativos_images_fixed.png"), fullPage: true });
  console.log("Captured: saas_criativos_images_fixed.png");

  await browser.close();
  console.log("Verification completed!");
}

verifyCreatives().catch(console.error);
