const { chromium } = require('playwright');

const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5186/?preview';
const detailUrl = `${baseUrl}#/sales-orders/ORD-00001`;

function readCount(counts) {
  return counts.getCoreOrderDetailForFrontend ?? 0;
}

async function getCounts(page) {
  return page.evaluate(() => window.__gasMockCallCounts ?? {});
}

async function main() {
  console.log('launching browser');
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/tanizawashingo/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(10_000);
    console.log('opening detail');
    await page.goto(`${baseUrl}#/dashboard`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    await page.evaluate(() => { window.location.hash = '#/sales-orders/ORD-00001'; });
    await page.waitForTimeout(100);
    console.log('initial url', page.url());
    console.log('initial body', JSON.stringify((await page.locator('body').innerText()).slice(0, 1000)));
    console.log('initial __gasMockCallCounts', JSON.stringify(await getCounts(page)));
    const paymentButton = page.getByRole('button', { name: '入金確認' });
    await paymentButton.waitFor();

    const firstCounts = await getCounts(page);
    const firstCount = readCount(firstCounts);
    console.log('a:first __gasMockCallCounts', JSON.stringify(firstCounts));

    await page.evaluate(() => { window.location.hash = '#/sales-orders'; });
    await page.getByRole('heading', { name: '受注管理' }).waitFor();
    await page.evaluate(() => { window.location.hash = '#/sales-orders/ORD-00001'; });
    await paymentButton.waitFor();
    const reopenedCounts = await getCounts(page);
    const reopenedCount = readCount(reopenedCounts);
    console.log('a:reopened __gasMockCallCounts', JSON.stringify(reopenedCounts));
    console.log(`a:getCoreOrderDetailForFrontend first=${firstCount} reopened=${reopenedCount}`);

    const beforeDisabled = await paymentButton.isDisabled();
    console.log(`b-2:before paymentButton.disabled=${beforeDisabled}`);

    await paymentButton.click();
    await page.getByRole('button', { name: '確定' }).click();
    await page.waitForFunction(() => (window.__gasMockCallCounts?.getCoreOrderDetailForFrontend ?? 0) > 1);

    const refreshedCounts = await getCounts(page);
    const refreshedCount = readCount(refreshedCounts);
    const afterDisabled = await paymentButton.isDisabled();
    console.log('b-1:after-confirm __gasMockCallCounts', JSON.stringify(refreshedCounts));
    console.log(`b-1:getCoreOrderDetailForFrontend reopened=${reopenedCount} afterConfirm=${refreshedCount}`);
    console.log(`b-2:after paymentButton.disabled=${afterDisabled}`);

    const passed = firstCount === reopenedCount
      && refreshedCount === reopenedCount + 1
      && beforeDisabled === false
      && afterDisabled === true;
    console.log(`PASS=${passed}`);
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
