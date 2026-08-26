const { chromium } = require('playwright');
const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5187/?preview';

async function counts(page) {
  return page.evaluate(() => window.__gasMockCallCounts ?? {});
}

async function openLeads(page) {
  await page.evaluate(() => { window.location.hash = '#/leads'; });
  await page.waitForTimeout(1000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(15_000);
    await page.goto(`${baseUrl}#/dashboard`, { waitUntil: 'networkidle' });
    // 初期ロード後: batch 1回のみ
    await page.waitForFunction(() =>
      (window.__gasMockCallCounts?.getLeadsBatchForFrontend ?? 0) >= 1
    );
    await openLeads(page);
    const afterLeads = await counts(page);

    console.log('after-leads __gasMockCallCounts', JSON.stringify(afterLeads));

    const batchCount     = afterLeads.getLeadsBatchForFrontend ?? 0;
    const oldLeadsCount  = afterLeads.getLeadsByType ?? 0;
    const oldOptsCount   = afterLeads.getLeadFormOptions ?? 0;

    console.log(`getLeadsBatchForFrontend=${batchCount} (expect 1)`);
    console.log(`getLeadsByType=${oldLeadsCount} (expect 0)`);
    console.log(`getLeadFormOptions=${oldOptsCount} (expect 0)`);

    const passed =
      batchCount === 1 &&
      oldLeadsCount === 0 &&
      oldOptsCount === 0;

    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
