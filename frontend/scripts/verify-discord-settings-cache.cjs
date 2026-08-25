const { chromium } = require('playwright');

const baseUrl = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5187/?preview';
const readCount = (counts) => ['getDiscordConnectionStatusForFrontend', 'getDiscordChannelsForFrontend', 'getDiscordOAuthStatus', 'getDiscordSetupStatus'].reduce((sum, key) => sum + (counts[key] ?? 0), 0);
async function counts(page) { return page.evaluate(() => window.__gasMockCallCounts ?? {}); }
async function poll(page) { await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(500); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(10_000);
    await page.goto(`${baseUrl}#/dashboard`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    await page.evaluate(() => { window.location.hash = '#/discord-integration'; });
    await page.getByRole('heading', { name: 'Discord連携' }).waitFor();
    await page.getByLabel('Discord Botトークン').waitFor();
    const initial = await counts(page); const initialCount = readCount(initial);

    await page.evaluate(() => { window.location.hash = '#/dashboard'; });
    await page.getByRole('heading', { name: 'ダッシュボード' }).waitFor();
    await page.evaluate(() => { window.location.hash = '#/discord-integration'; });
    await page.getByLabel('Discord Botトークン').waitFor();
    const reopened = await counts(page); const reopenedCount = readCount(reopened);

    await poll(page); await page.evaluate(() => window.__gasMockTriggerSyncSignal?.('discord')); await poll(page);
    await page.waitForFunction((count) => ['getDiscordConnectionStatusForFrontend', 'getDiscordChannelsForFrontend', 'getDiscordOAuthStatus', 'getDiscordSetupStatus'].reduce((sum, key) => sum + (window.__gasMockCallCounts?.[key] ?? 0), 0) > count, reopenedCount);
    const afterSignal = await counts(page); const afterSignalCount = readCount(afterSignal);

    await page.getByLabel('Discord Botトークン').fill('preview-token');
    await page.getByRole('button', { name: '保存して接続' }).click();
    await page.waitForFunction((count) => ['getDiscordConnectionStatusForFrontend', 'getDiscordChannelsForFrontend', 'getDiscordOAuthStatus', 'getDiscordSetupStatus'].reduce((sum, key) => sum + (window.__gasMockCallCounts?.[key] ?? 0), 0) > count, afterSignalCount);
    await page.getByText('保存して接続しました。', { exact: false }).waitFor();
    const afterSave = await counts(page); const afterSaveCount = readCount(afterSave);

    console.log('initial __gasMockCallCounts', JSON.stringify(initial));
    console.log('reopened __gasMockCallCounts', JSON.stringify(reopened));
    console.log('after-signal __gasMockCallCounts', JSON.stringify(afterSignal));
    console.log('after-save __gasMockCallCounts', JSON.stringify(afterSave));
    console.log(`discordSettings initial=${initialCount} reopened=${reopenedCount} afterSignal=${afterSignalCount} afterSave=${afterSaveCount}`);
    const passed = initialCount === 4 && reopenedCount === initialCount && afterSignalCount === reopenedCount + 4 && afterSaveCount === afterSignalCount + 4;
    console.log(`PASS=${passed}`); if (!passed) process.exitCode = 1;
  } finally { await browser.close(); }
}
void main();
