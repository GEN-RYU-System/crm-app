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
  try {
    page.setDefaultTimeout(10_000);
    await page.goto(`${baseUrl}#/inbox`, { waitUntil: 'networkidle' });
    await page.locator('.inbox-preview__row').filter({ hasText: 'Preview Inbox Customer 1' }).first().click();
    await page.locator('.inbox-preview__message').first().waitFor();
    const afterA = await counts(page);
    const afterACount = afterA.getInboxConversationDetailForFrontend ?? 0;

    await page.locator('.inbox-preview__row').filter({ hasText: 'Preview Inbox Customer 2' }).first().click();
    await page.locator('.inbox-preview__message').nth(74).waitFor();
    const afterB = await counts(page);
    const afterBCount = afterB.getInboxConversationDetailForFrontend ?? 0;
    const ldi00002Messages = await page.locator('.inbox-preview__message').count();

    await page.locator('.inbox-preview__row').filter({ hasText: 'Preview Inbox Customer 1' }).first().click();
    await page.locator('.inbox-preview__message').first().waitFor();
    const afterReturnA = await counts(page);
    const afterReturnACount = afterReturnA.getInboxConversationDetailForFrontend ?? 0;

    await poll(page);
    await page.evaluate(() => window.__gasMockTriggerSyncSignal?.('inbox'));
    await poll(page);
    await page.waitForFunction((count) => (window.__gasMockCallCounts?.getInboxConversationDetailForFrontend ?? 0) > count, afterReturnACount);
    const afterSignal = await counts(page);
    const afterSignalCount = afterSignal.getInboxConversationDetailForFrontend ?? 0;

    console.log('after-A __gasMockCallCounts', JSON.stringify(afterA));
    console.log('after-B __gasMockCallCounts', JSON.stringify(afterB));
    console.log('after-return-A __gasMockCallCounts', JSON.stringify(afterReturnA));
    console.log('after-signal __gasMockCallCounts', JSON.stringify(afterSignal));
    console.log(`getInboxConversationDetailForFrontend afterA=${afterACount} afterB=${afterBCount} afterReturnA=${afterReturnACount} afterSignal=${afterSignalCount}`);
    console.log(`LDI-00002 messages=${ldi00002Messages}`);
    const passed = afterBCount === afterACount + 1 && afterReturnACount === afterBCount && afterSignalCount === afterReturnACount + 2 && ldi00002Messages === 75;
    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
