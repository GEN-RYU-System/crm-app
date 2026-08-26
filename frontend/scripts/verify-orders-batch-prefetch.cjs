const { chromium } = require('playwright');
const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5187/?preview';

async function counts(page) {
  return page.evaluate(() => window.__gasMockCallCounts ?? {});
}

async function openOrders(page) {
  await page.evaluate(() => { window.location.hash = '#/orders'; });
  await page.waitForTimeout(1000);
}

async function openSalesOrders(page) {
  await page.evaluate(() => { window.location.hash = '#/sales-orders'; });
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
      (window.__gasMockCallCounts?.getCoreOrdersBatchForFrontend ?? 0) >= 1
    );
    await openOrders(page);
    const afterOrders = await counts(page);
    await openSalesOrders(page);
    const afterSalesOrders = await counts(page);

    console.log('after-orders __gasMockCallCounts', JSON.stringify(afterOrders));
    console.log('after-salesOrders __gasMockCallCounts', JSON.stringify(afterSalesOrders));

    const batchCount = afterSalesOrders.getCoreOrdersBatchForFrontend ?? 0;
    const oldOrdersCount = afterSalesOrders.getCoreOrdersForFrontend ?? 0;
    const oldStatusCount = afterSalesOrders.getCoreOrderStatusOptionsForFrontend ?? 0;

    console.log(`getCoreOrdersBatchForFrontend=${batchCount} (expect 1)`);
    console.log(`getCoreOrdersForFrontend=${oldOrdersCount} (expect 0)`);
    console.log(`getCoreOrderStatusOptionsForFrontend=${oldStatusCount} (expect 0)`);

    const passed =
      batchCount === 1 &&
      oldOrdersCount === 0 &&
      oldStatusCount === 0;

    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
