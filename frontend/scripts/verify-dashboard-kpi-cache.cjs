const { chromium } = require('playwright');

const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5186/?preview';

async function counts(page) {
  return page.evaluate(() => window.__gasMockCallCounts ?? {});
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(10_000);
    console.log('starting preview verification');
    await page.goto(`${baseUrl}#/dashboard`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    const first = await counts(page);

    await page.evaluate(() => { window.location.hash = '#/leads'; });
    await page.getByRole('heading', { name: 'リード一覧' }).waitFor();
    await page.evaluate(() => { window.location.hash = '#/dashboard'; });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    const reopened = await counts(page);

    const firstCount = first.getDashboardKPIs ?? 0;
    const reopenedCount = reopened.getDashboardKPIs ?? 0;
    console.log('first __gasMockCallCounts', JSON.stringify(first));
    console.log('reopened __gasMockCallCounts', JSON.stringify(reopened));
    console.log(`getDashboardKPIs first=${firstCount} reopened=${reopenedCount}`);
    console.log(`PASS=${firstCount === 1 && reopenedCount === firstCount}`);
    if (firstCount !== 1 || reopenedCount !== firstCount) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
