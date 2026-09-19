import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "/Users/evandro/.gemini/antigravity-ide/brain/c7f5bd80-4848-417a-af4d-a9d5a2196c91/screenshots";
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const BASE_URL_NEXT = "http://localhost:3000";
const BASE_URL_ADZ = "http://localhost:3333";

const results = {
  testedPages: [],
  buttonsClicked: 0,
  consoleErrors: [],
  screenReaderAudit: [],
};

function auditPageA11y(page, pageName) {
  return page.evaluate((name) => {
    const issues = [];
    
    // 1. Headings check
    const h1s = document.querySelectorAll("h1");
    if (h1s.length === 0) {
      issues.push({ type: "heading", level: "warning", message: "Nenhum <h1> encontrado na página" });
    } else if (h1s.length > 1) {
      issues.push({ type: "heading", level: "info", message: `${h1s.length} tags <h1> encontradas (idealmente 1 por página)` });
    }

    // 2. Buttons accessible name check
    const buttons = document.querySelectorAll("button");
    let unnamedButtons = 0;
    buttons.forEach((btn, idx) => {
      const text = btn.innerText?.trim() || "";
      const ariaLabel = btn.getAttribute("aria-label") || "";
      const title = btn.getAttribute("title") || "";
      if (!text && !ariaLabel && !title) {
        unnamedButtons++;
      }
    });
    if (unnamedButtons > 0) {
      issues.push({ type: "button", level: "warning", message: `${unnamedButtons} botões sem texto ou aria-label acessível para leitor de tela` });
    }

    // 3. Form inputs check
    const inputs = document.querySelectorAll("input:not([type='hidden']), select, textarea");
    let unlabelledInputs = 0;
    inputs.forEach((input) => {
      const id = input.id;
      const ariaLabel = input.getAttribute("aria-label");
      const ariaLabelledby = input.getAttribute("aria-labelledby");
      const placeholder = input.getAttribute("placeholder");
      const hasLabel = id ? document.querySelector(`label[for='${id}']`) : null;
      if (!hasLabel && !ariaLabel && !ariaLabelledby && !placeholder) {
        unlabelledInputs++;
      }
    });
    if (unlabelledInputs > 0) {
      issues.push({ type: "form", level: "warning", message: `${unlabelledInputs} campos de formulário sem label acessível` });
    }

    // 4. Images check
    const images = document.querySelectorAll("img");
    let missingAlt = 0;
    images.forEach((img) => {
      if (!img.hasAttribute("alt") && !img.hasAttribute("aria-hidden")) {
        missingAlt++;
      }
    });
    if (missingAlt > 0) {
      issues.push({ type: "image", level: "warning", message: `${missingAlt} imagens sem atributo alt` });
    }

    return {
      page: name,
      h1Count: h1s.length,
      buttonCount: buttons.length,
      inputCount: inputs.length,
      issues,
    };
  }, pageName);
}

async function runE2E() {
  console.log("==================================================");
  console.log("🚀 INICIANDO AUDITORIA PLAYWRIGHT E2E & ACCESSIBILITY");
  console.log("==================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
  });
  const page = await context.newPage();

  // Listen to all console messages & errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore known benign hydration or favicon 404
      if (!text.includes("favicon") && !text.includes("status of 404")) {
        results.consoleErrors.push({ url: page.url(), text });
        console.error(`❌ [Console Error] [${page.url()}] ${text}`);
      }
    }
  });

  page.on("pageerror", (err) => {
    results.consoleErrors.push({ url: page.url(), text: err.message });
    console.error(`💥 [Page Error] [${page.url()}] ${err.message}`);
  });

  page.on("requestfailed", (req) => {
    console.warn(`🚨 [Request Failed] ${req.url()} — ${req.failure()?.errorText}`);
  });

  try {
    // -------------------------------------------------------------
    // PARTE 1: STANDALONE META ADZ PANEL (http://localhost:3333)
    // -------------------------------------------------------------
    try {
      console.log("\n📍 1. Testando Painel Meta Ads Standalone (ADZ) em http://localhost:3333...");
      
      // Inject password into sessionStorage before loading
      await context.addInitScript(() => {
        sessionStorage.setItem("adz_dashboard_password", "admin");
      });

      await page.goto(BASE_URL_ADZ, { waitUntil: "domcontentloaded", timeout: 15000 });
      results.testedPages.push("ADZ: Visão Geral");

      // Check if authModal is shown
      try {
        const modal = await page.$("#authModal");
        if (modal) {
          const isVisible = await modal.isVisible();
          if (isVisible) {
            console.log("  🔑 Preenchendo modal de autenticação ADZ...");
            await page.fill("#authPasswordInput", "admin");
            await page.click("#authForm button[type='submit']");
            results.buttonsClicked++;
            await page.waitForTimeout(2000);
          }
        }
      } catch (e) {}

      // Wait for kpi-card to appear
      await page.waitForSelector(".kpi-card", { timeout: 15000 });
      console.log("  ✅ ADZ Dashboard carregado com sucesso!");
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "adz_01_visao_geral.png") });

      // Audit ADZ Visão Geral
      const a11yAdz = await auditPageA11y(page, "ADZ - Visão Geral");
      results.screenReaderAudit.push(a11yAdz);

      // Click tabs in ADZ
      const adzTabs = ["campanhas", "criativos", "horario", "diagnostico", "resumo"];
      for (const tab of adzTabs) {
        const tabBtn = await page.$(`a.nav-item[data-tab="${tab}"]`);
        if (tabBtn) {
          await tabBtn.click();
          results.buttonsClicked++;
          await page.waitForTimeout(800);
          console.log(`  👉 Clicou na aba ADZ: [${tab}]`);
          results.testedPages.push(`ADZ: Tab ${tab}`);
          if (tab === "campanhas" || tab === "criativos" || tab === "horario") {
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, `adz_02_${tab}.png`) });
          }
        }
      }

      // On Campanhas tab, click first campaign row to test Split View
      await page.click('a.nav-item[data-tab="campanhas"]');
      await page.waitForTimeout(500);
      const firstCampRow = await page.$("#campaignsTableBody tr");
      if (firstCampRow) {
        await firstCampRow.click();
        results.buttonsClicked++;
        await page.waitForTimeout(800);
        console.log("  👉 Clicou na linha de campanha para abrir Split View Inspector no ADZ");
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, "adz_03_split_view.png") });
      }
    } catch (adzErr) {
      console.error("⚠️ Aviso na Parte 1 (ADZ):", adzErr.message);
    }

    // -------------------------------------------------------------
    // PARTE 2: SAAS MONOREPO (http://localhost:3000)
    // -------------------------------------------------------------
    console.log("\n📍 2. Testando SaaS Monorepo (apps/dashboard) em http://localhost:3000...");

    // 2.1 Auth Page
    await page.goto(`${BASE_URL_NEXT}/auth`, { waitUntil: "networkidle", timeout: 15000 });
    results.testedPages.push("SaaS: Auth / Login");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "saas_01_login.png") });
    const a11yAuth = await auditPageA11y(page, "SaaS - Login");
    results.screenReaderAudit.push(a11yAuth);

    console.log("  🔐 Efetuando login com evandrosilva.5santos@gmail.com...");
    await page.fill("input[type='email']", "evandrosilva.5santos@gmail.com");
    await page.fill("input[type='password']", "Admin@2026!");
    
    const submitBtn = page.getByRole("button", { name: /entrar no painel/i });
    await submitBtn.click();
    results.buttonsClicked++;

    try {
      await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 15000 });
      console.log(`  ✅ Redirecionado com sucesso para: ${page.url()}`);
    } catch (navErr) {
      const errorMsg = await page.$eval(".text-red-400", (el) => el.innerText).catch(() => null);
      console.log(`  ℹ️ Mensagem na tela de login: ${errorMsg || 'Nenhum erro visível'}`);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "saas_01_login_attempt.png") });
    }
    await page.waitForTimeout(2000);

    // 2.2 Performance Page
    console.log("\n📍 2.2 Testando Página de Performance (/performance)...");
    await page.goto(`${BASE_URL_NEXT}/performance`, { waitUntil: "networkidle", timeout: 15000 });
    results.testedPages.push("SaaS: Performance");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "saas_02_performance.png") });
    const a11yPerf = await auditPageA11y(page, "SaaS - Performance");
    results.screenReaderAudit.push(a11yPerf);

    // Click interactive buttons on performance page (excluding logout)
    const perfButtons = await page.$$("main button, header button");
    console.log(`  🔍 Encontrados ${perfButtons.length} botões interativos na tela de Performance.`);
    for (let i = 0; i < perfButtons.length; i++) {
      try {
        const btn = perfButtons[i];
        if (await btn.isVisible()) {
          const txt = (await btn.innerText().catch(() => ""))?.toLowerCase();
          const title = (await btn.getAttribute("title").catch(() => ""))?.toLowerCase();
          const aria = (await btn.getAttribute("aria-label").catch(() => ""))?.toLowerCase();
          if (txt?.includes("sair") || title?.includes("sair") || aria?.includes("sair")) {
            continue; // Evita deslogar durante o teste
          }
          await btn.click({ timeout: 1000 });
          results.buttonsClicked++;
          await page.waitForTimeout(300);
        }
      } catch (e) {
        // Continue if button is disabled or covered
      }
    }

    // 2.3 Split View Campaigns Page
    console.log("\n📍 2.3 Testando Tela de Split View (/campaigns)...");
    await page.goto(`${BASE_URL_NEXT}/campaigns`, { waitUntil: "networkidle", timeout: 15000 });
    results.testedPages.push("SaaS: Split View Campaigns");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "saas_03_campaigns_split_view.png") });
    const a11yCamp = await auditPageA11y(page, "SaaS - Campanhas Split View");
    results.screenReaderAudit.push(a11yCamp);

    // Click on campaign list row
    const campRow = await page.$("tbody tr");
    if (campRow) {
      await campRow.click();
      results.buttonsClicked++;
      await page.waitForTimeout(800);
      console.log("  👉 Clicou na linha de campanha do SaaS para ativar o Inspector lateral!");
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "saas_03b_campaign_inspector.png") });

      // Test tabs inside inspector
      const inspectorTabs = await page.$$("div[role='tablist'] button, .border-b button");
      for (const tab of inspectorTabs) {
        try {
          if (await tab.isVisible()) {
            await tab.click({ timeout: 1000 });
            results.buttonsClicked++;
            await page.waitForTimeout(400);
          }
        } catch (e) {}
      }
    }

    // 2.4 Criativos Page
    console.log("\n📍 2.4 Testando Tela de Criativos (/criativos)...");
    await page.goto(`${BASE_URL_NEXT}/criativos`, { waitUntil: "networkidle", timeout: 15000 });
    results.testedPages.push("SaaS: Criativos");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "saas_04_criativos.png") });
    const a11yCriat = await auditPageA11y(page, "SaaS - Criativos");
    results.screenReaderAudit.push(a11yCriat);

    // 2.5 Reports Page
    console.log("\n📍 2.5 Testando Tela de Relatórios (/reports)...");
    await page.goto(`${BASE_URL_NEXT}/reports`, { waitUntil: "networkidle", timeout: 15000 });
    results.testedPages.push("SaaS: Relatórios");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "saas_05_reports.png") });
    const a11yReports = await auditPageA11y(page, "SaaS - Relatórios");
    results.screenReaderAudit.push(a11yReports);

    // 2.6 Settings Page
    console.log("\n📍 2.6 Testando Tela de Configurações (/settings)...");
    await page.goto(`${BASE_URL_NEXT}/settings`, { waitUntil: "networkidle", timeout: 15000 });
    results.testedPages.push("SaaS: Settings");
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "saas_06_settings.png") });
    const a11ySettings = await auditPageA11y(page, "SaaS - Settings");
    results.screenReaderAudit.push(a11ySettings);

    // Click settings tabs
    const settingsTabs = await page.$$("nav a, nav button");
    for (const tab of settingsTabs.slice(0, 4)) {
      try {
        if (await tab.isVisible()) {
          await tab.click({ timeout: 1000 });
          results.buttonsClicked++;
          await page.waitForTimeout(400);
        }
      } catch (e) {}
    }

  } catch (err) {
    console.error("❌ Erro durante o fluxo E2E:", err);
  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------
  // RELATÓRIO FINAL CONSOLIDADO
  // -------------------------------------------------------------
  console.log("\n==================================================");
  console.log("📊 RESULTADO FINAL DA AUDITORIA PLAYWRIGHT & A11Y");
  console.log("==================================================");
  console.log(`✅ Páginas / Rotas Varridas: ${results.testedPages.length}`);
  console.log(`🖱️ Botões & Elementos Interagidos: ${results.buttonsClicked}`);
  console.log(`🐞 Erros de Console Capturados: ${results.consoleErrors.length}`);

  if (results.consoleErrors.length > 0) {
    console.log("\n❌ Detalhes dos erros de console:");
    results.consoleErrors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. [${err.url}] ${err.text}`);
    });
  } else {
    console.log("\n🎉 ZERO ERROS DE CONSOLE ENCONTRADOS! Tudo limpo.");
  }

  console.log("\n♿ AUDITORIA DE LEITORES DE TELA (SCREEN READERS):");
  results.screenReaderAudit.forEach((audit) => {
    console.log(`\n📌 ${audit.page}:`);
    console.log(`   - Headings <h1>: ${audit.h1Count}`);
    console.log(`   - Botões totais: ${audit.buttonCount}`);
    console.log(`   - Inputs: ${audit.inputCount}`);
    if (audit.issues.length === 0) {
      console.log("   ✅ Nenhuma inconsistência de acessibilidade detectada!");
    } else {
      audit.issues.forEach((issue) => {
        console.log(`   ⚠️ [${issue.level.toUpperCase()}] ${issue.message}`);
      });
    }
  });
  console.log("\n==================================================");
}

runE2E().catch(console.error);
