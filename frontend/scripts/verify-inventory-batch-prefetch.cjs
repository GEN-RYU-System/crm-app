const { chromium } = require('playwright');
const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5187/?preview';

async function counts(page) {
  return page.evaluate(() => window.__gasMockCallCounts ?? {});
}

async function openInventory(page) {
  await page.evaluate(() => { window.location.hash = '#/inventory'; });
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
      (window.__gasMockCallCounts?.getInventoryBatchForFrontend ?? 0) >= 1
    );
    await openInventory(page);
    const afterInventory = await counts(page);

    console.log('after-inventory __gasMockCallCounts', JSON.stringify(afterInventory));

    const batchCount      = afterInventory.getInventoryBatchForFrontend ?? 0;
    const oldInvCount     = afterInventory.getSharedInventoryForFrontend ?? 0;
    const oldOptsCount    = afterInventory.getInventoryProductOptions ?? 0;

    console.log(`getInventoryBatchForFrontend=${batchCount} (expect 1)`);
    console.log(`getSharedInventoryForFrontend=${oldInvCount} (expect 0)`);
    console.log(`getInventoryProductOptions=${oldOptsCount} (expect 0)`);

    const passed =
      batchCount === 1 &&
      oldInvCount === 0 &&
      oldOptsCount === 0;

    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
