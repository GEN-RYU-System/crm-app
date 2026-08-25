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
    await page.goto(`${baseUrl}#/dashboard`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    await page.evaluate(() => { window.location.hash = '#/issuer-master'; });
    await page.getByRole('heading', { name: '発行元情報' }).waitFor();
    await page.getByLabel('会社名').waitFor();
    const initial = await counts(page);
    const initialCount = initial.getCoreIssuerForFrontend ?? 0;

    await page.evaluate(() => { window.location.hash = '#/dashboard'; });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    await page.evaluate(() => { window.location.hash = '#/issuer-master'; });
    await page.getByLabel('会社名').waitFor();
    const reopened = await counts(page);
    const reopenedCount = reopened.getCoreIssuerForFrontend ?? 0;

    await poll(page);
    await page.evaluate(() => window.__gasMockTriggerSyncSignal?.('issuer'));
    await poll(page);
    await page.waitForFunction((count) => (window.__gasMockCallCounts?.getCoreIssuerForFrontend ?? 0) > count, reopenedCount);
    const afterSignal = await counts(page);
    const afterSignalCount = afterSignal.getCoreIssuerForFrontend ?? 0;

    const nextCompanyName = 'Preview Company Updated';
    await page.getByLabel('会社名').fill(nextCompanyName);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('保存しました', { exact: true }).waitFor();
    await page.waitForFunction((count) => (window.__gasMockCallCounts?.getCoreIssuerForFrontend ?? 0) > count, afterSignalCount);
    const afterSave = await counts(page);
    const afterSaveCount = afterSave.getCoreIssuerForFrontend ?? 0;
    const displayed = await page.getByLabel('会社名').inputValue();

    console.log('initial __gasMockCallCounts', JSON.stringify(initial));
    console.log('reopened __gasMockCallCounts', JSON.stringify(reopened));
    console.log('after-signal __gasMockCallCounts', JSON.stringify(afterSignal));
    console.log('after-save __gasMockCallCounts', JSON.stringify(afterSave));
    console.log(`getCoreIssuerForFrontend initial=${initialCount} reopened=${reopenedCount} afterSignal=${afterSignalCount} afterSave=${afterSaveCount}`);
    console.log(`displayedCompanyName=${displayed}`);
    const passed = initialCount === 1 && reopenedCount === initialCount && afterSignalCount === reopenedCount + 1 && afterSaveCount === afterSignalCount + 1 && displayed === nextCompanyName;
    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
