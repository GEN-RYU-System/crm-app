const { chromium } = require('playwright');

const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5187/?preview';

async function counts(page) {
  return page.evaluate(() => window.__gasMockCallCounts ?? {});
}

async function poll(page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (message) => console.log(`browser:${message.type()} ${message.text()}`));
  try {
    page.setDefaultTimeout(10_000);
    await page.goto(`${baseUrl}#/dashboard`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    const initial = await counts(page);
    const initialCount = initial.getInventoryProductOptions ?? 0;

    await page.evaluate(() => { window.location.hash = '#/orders'; });
    await page.waitForTimeout(100);
    const beforeSignal = await counts(page);
    const beforeSignalCount = beforeSignal.getInventoryProductOptions ?? 0;

    await poll(page);
    await page.evaluate(() => window.__gasMockTriggerSyncSignal?.('inventory'));
    await poll(page);
    await page.waitForFunction((count) => (window.__gasMockCallCounts?.getInventoryProductOptions ?? 0) > count, beforeSignalCount);
    const afterSignal = await counts(page);
    const afterSignalCount = afterSignal.getInventoryProductOptions ?? 0;

    console.log('initial __gasMockCallCounts', JSON.stringify(initial));
    console.log('no-signal __gasMockCallCounts', JSON.stringify(beforeSignal));
    console.log('signal __gasMockCallCounts', JSON.stringify(afterSignal));
    console.log(`getInventoryProductOptions initial=${initialCount} noSignal=${beforeSignalCount} afterSignal=${afterSignalCount}`);
    const passed = initialCount === beforeSignalCount && afterSignalCount === beforeSignalCount + 1;
    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
