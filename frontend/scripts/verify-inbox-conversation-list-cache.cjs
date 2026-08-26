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
    // Wait for bulk load to complete (conversations seeded from bulk result)
    await page.waitForFunction(() => (window.__gasMockCallCounts?.getInboxBulkInitialLoad ?? 0) >= 1);
    await openInbox(page);
    const initial = await counts(page);
    const initialRows = await page.locator('.inbox-preview__row').count();

    await page.evaluate(() => { window.location.hash = '#/dashboard'; });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    await openInbox(page);
    const reopened = await counts(page);

    await poll(page);
    await page.evaluate(() => window.__gasMockTriggerSyncSignal?.('inbox'));
    await poll(page);
    const reopenedSignalCount = reopened.getInboxConversationsForFrontend ?? 0;
    await page.waitForFunction((count) => (window.__gasMockCallCounts?.getInboxConversationsForFrontend ?? 0) > count, reopenedSignalCount);
    const afterSignal = await counts(page);
    const afterSignalRows = await page.locator('.inbox-preview__row').count();

    console.log('initial __gasMockCallCounts', JSON.stringify(initial));
    console.log('reopened __gasMockCallCounts', JSON.stringify(reopened));
    console.log('after-signal __gasMockCallCounts', JSON.stringify(afterSignal));
    console.log(`getInboxConversationsForFrontend initial=${initial.getInboxConversationsForFrontend ?? 0} reopened=${reopened.getInboxConversationsForFrontend ?? 0} afterSignal=${afterSignal.getInboxConversationsForFrontend ?? 0}`);
    console.log(`getInboxBulkInitialLoad initial=${initial.getInboxBulkInitialLoad ?? 0} reopened=${reopened.getInboxBulkInitialLoad ?? 0} afterSignal=${afterSignal.getInboxBulkInitialLoad ?? 0}`);
    console.log(`inboxRows initial=${initialRows} afterSignal=${afterSignalRows}`);

    // initial: bulk load 1回で会話一覧が表示される (getInboxConversationsForFrontend は呼ばれない)
    // reopened: キャッシュヒット、追加GAS呼び出しなし
    // after-signal: refresh で getInboxConversationsForFrontend が1回呼ばれる
    const passed =
      (initial.getInboxConversationsForFrontend ?? 0) === 0 &&
      (initial.getInboxBulkInitialLoad ?? 0) === 1 &&
      initialRows === 25 &&
      (reopened.getInboxBulkInitialLoad ?? 0) === 1 &&
      (afterSignal.getInboxConversationsForFrontend ?? 0) === 1 &&
      afterSignalRows === 25;
    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
