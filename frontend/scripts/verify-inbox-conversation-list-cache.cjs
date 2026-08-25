const { chromium } = require('playwright');

const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5187/?preview';

async function counts(page) {
  return page.evaluate(() => window.__gasMockCallCounts ?? {});
}

async function poll(page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(500);
}

async function openInbox(page) {
  await page.evaluate(() => { window.location.hash = '#/inbox'; });
  await page.getByRole('heading', { name: '受信箱' }).waitFor();
  await page.locator('.inbox-preview__row').first().waitFor();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(10_000);
    await page.goto(`${baseUrl}#/dashboard`, { waitUntil: 'networkidle' });
    await openInbox(page);
    const initial = await counts(page);
    const initialCount = initial.getInboxConversationsForFrontend ?? 0;
    const initialRows = await page.locator('.inbox-preview__row').count();

    await page.evaluate(() => { window.location.hash = '#/dashboard'; });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    await openInbox(page);
    const reopened = await counts(page);
    const reopenedCount = reopened.getInboxConversationsForFrontend ?? 0;

    await poll(page);
    await page.evaluate(() => window.__gasMockTriggerSyncSignal?.('inbox'));
    await poll(page);
    await page.waitForFunction((count) => (window.__gasMockCallCounts?.getInboxConversationsForFrontend ?? 0) > count, reopenedCount);
    const afterSignal = await counts(page);
    const afterSignalCount = afterSignal.getInboxConversationsForFrontend ?? 0;
    const afterSignalRows = await page.locator('.inbox-preview__row').count();

    console.log('initial __gasMockCallCounts', JSON.stringify(initial));
    console.log('reopened __gasMockCallCounts', JSON.stringify(reopened));
    console.log('after-signal __gasMockCallCounts', JSON.stringify(afterSignal));
    console.log(`getInboxConversationsForFrontend initial=${initialCount} reopened=${reopenedCount} afterSignal=${afterSignalCount}`);
    console.log(`inboxRows initial=${initialRows} afterSignal=${afterSignalRows}`);
    const passed = initialCount === 1 && reopenedCount === initialCount && afterSignalCount === reopenedCount + 1 && initialRows === 25 && afterSignalRows === 25;
    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
