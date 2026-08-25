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
    await page.evaluate(() => { window.location.hash = '#/sales-orders/ORD-00001'; });
    await page.getByRole('button', { name: '入金確認' }).waitFor();
    const initial = await counts(page);
    const initialCount = initial.getCoreOrderDetailForFrontend ?? 0;

    await poll(page);
    const beforeSignal = await counts(page);
    const beforeSignalCount = beforeSignal.getCoreOrderDetailForFrontend ?? 0;

    await page.evaluate(() => window.__gasMockTriggerSyncSignal?.('orders'));
    await poll(page);
    await page.waitForFunction((count) => (window.__gasMockCallCounts?.getCoreOrderDetailForFrontend ?? 0) > count, beforeSignalCount);
    const afterSignal = await counts(page);
    const afterSignalCount = afterSignal.getCoreOrderDetailForFrontend ?? 0;

    console.log('initial __gasMockCallCounts', JSON.stringify(initial));
    console.log('no-signal __gasMockCallCounts', JSON.stringify(beforeSignal));
    console.log('signal __gasMockCallCounts', JSON.stringify(afterSignal));
    console.log(`getCoreOrderDetailForFrontend initial=${initialCount} noSignal=${beforeSignalCount} afterSignal=${afterSignalCount}`);
    const passed = initialCount === 1 && initialCount === beforeSignalCount && afterSignalCount === beforeSignalCount + 1;
    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
