const { chromium } = require('playwright');
const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5194/?preview';
const count = (counts) => counts.getCoreOrderDetailForFrontend ?? 0;
const counts = (page) => page.evaluate(() => window.__gasMockCallCounts ?? {});
async function poll(page) { await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(500); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(10_000);
    await page.goto(`${baseUrl}#/orders/ORD-00001`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '発送情報を編集' }).waitFor();
    const initial = await counts(page); const initialCount = count(initial);
    await page.evaluate(() => { window.location.hash = '#/dashboard'; });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    await page.evaluate(() => { window.location.hash = '#/orders/ORD-00001'; });
    await page.getByRole('button', { name: '発送情報を編集' }).waitFor();
    const reopened = await counts(page); const reopenedCount = count(reopened);
    await poll(page); await page.evaluate(() => window.__gasMockTriggerSyncSignal?.('orders')); await poll(page);
    await page.waitForFunction((n) => (window.__gasMockCallCounts?.getCoreOrderDetailForFrontend ?? 0) > n, reopenedCount);
    const afterSignal = await counts(page); const afterSignalCount = count(afterSignal);
    await page.getByRole('button', { name: '発送情報を編集' }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.waitForFunction((n) => (window.__gasMockCallCounts?.getCoreOrderDetailForFrontend ?? 0) > n, afterSignalCount);
    const afterSave = await counts(page); const afterSaveCount = count(afterSave);
    console.log('initial __gasMockCallCounts', JSON.stringify(initial));
    console.log('reopened __gasMockCallCounts', JSON.stringify(reopened));
    console.log('after-signal __gasMockCallCounts', JSON.stringify(afterSignal));
    console.log('after-save __gasMockCallCounts', JSON.stringify(afterSave));
    console.log(`getCoreOrderDetailForFrontend initial=${initialCount} reopened=${reopenedCount} afterSignal=${afterSignalCount} afterSave=${afterSaveCount}`);
    const pass = initialCount === 1 && reopenedCount === initialCount && afterSignalCount === reopenedCount + 1 && afterSaveCount === afterSignalCount + 1;
    console.log(`PASS=${pass}`); if (!pass) process.exitCode = 1;
  } finally { await browser.close(); }
}
void main();
