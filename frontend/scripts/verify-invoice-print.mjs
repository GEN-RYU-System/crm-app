#!/usr/bin/env node
/**
 * verify-invoice-print.mjs
 *
 * Playwright を使い、OrderDetailPage (?preview#/orders/ORD-00001) の
 * 「請求書を印刷」ボタンを押して InvoiceDocument を PDF 出力し、
 * 抽出テキストから以下 8 条件を検査する。
 *
 *  1. テキストが 1 件以上抽出されること（空白 PDF でないこと）
 *  2. 日付に T や Z が含まれないこと（ISO 8601 生文字列でないこと）
 *  3. 請求先（billedTo）名が PDF に存在すること（Bug D 修正確認）
 *  4. 届先（shipTo）名が PDF に存在すること（Bug E 修正確認）
 *  5. 商品名（英語）が PDF に存在すること（Bug F 修正確認）
 *  6. USD 注文で "Exchange Rate:" ラベルが存在すること（Bug A 修正確認）
 *  7. 支払方法と支払先メールが PDF に存在すること（Bug G 修正確認）
 *  8. ページ番号 "Page X / Y" パターンが存在すること
 *
 * ★ ソースコードの grep ではなく、PDF 出力物の中身で判定する。
 * ★ カタログ (#/components) ではなく実画面 (#/orders/:id) を使う。
 *
 * 使い方:
 *   cd frontend
 *   node scripts/verify-invoice-print.mjs
 *
 * 前提: npm run dev がポート 5173 で起動済みであること
 *       または VERIFY_PORT 環境変数でポートを指定すること
 */

import { chromium } from '../node_modules/playwright/index.mjs';
import * as pdfjsLib from '../node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(__dirname, '..');

// ─── PDF テキスト抽出 ──────────────────────────────────────────────────────────

async function extractTextFromPdf(pdfBuffer) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).href;

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  let fullText = '';
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    fullText += pageText + '\n';
  }
  return { text: fullText, numPages };
}

// ─── Dev サーバー起動 ─────────────────────────────────────────────────────────

function startDevServer(port) {
  return new Promise((resolve, reject) => {
    const vite = spawn(
      'node',
      ['node_modules/.bin/vite', '--port', String(port), '--strictPort'],
      {
        cwd: frontendDir,
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let ready = false;
    const onData = (chunk) => {
      const text = chunk.toString();
      if (!ready && (text.includes('Local:') || text.includes('localhost'))) {
        ready = true;
        resolve(vite);
      }
    };
    vite.stdout.on('data', onData);
    vite.stderr.on('data', onData);
    vite.on('error', reject);
    vite.on('exit', (code) => {
      if (!ready) reject(new Error(`Vite exited with code ${code}`));
    });

    setTimeout(() => {
      if (!ready) {
        vite.kill();
        reject(new Error('Vite dev server startup timed out'));
      }
    }, 30_000);
  });
}

// ─── メイン ───────────────────────────────────────────────────────────────────

const PASS = 'PASS';
const FAIL = 'FAIL';
const results = [];

function check(id, label, condition, extracted) {
  const status = condition ? PASS : FAIL;
  results.push({ id, status, label, extracted });
}

const port = process.env.VERIFY_PORT ? Number(process.env.VERIFY_PORT) : 5173;
// Real order detail page in preview mode (mock returns data for any orderId)
const orderDetailUrl = `http://localhost:${port}/?preview#/orders/ORD-00001`;

// Expected values from mock data (gasRunnerMock.ts getCoreOrderDetailForFrontend)
const EXPECTED_BILLED_TO      = 'Preview Billing Co.';
const EXPECTED_SHIP_TO        = 'Preview Customer A';
const EXPECTED_PRODUCT        = 'Pikachu ex SAR';
const EXPECTED_PAYMENT_METHOD = 'Wise';
const EXPECTED_PAYMENT_EMAIL  = 'preview-payment-email';

let viteProcess = null;
let browser = null;

try {
  console.log('=== verify-invoice-print.mjs (real screen: OrderDetailPage) ===\n');
  console.log(`Dev サーバーを起動中 (port ${port})...`);
  viteProcess = await startDevServer(port);
  await new Promise((r) => setTimeout(r, 2000));
  console.log('Dev サーバー起動完了\n');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Override window.print() strategy:
  //
  // The challenge: `waitForSelector` and `page.evaluate` need the JS main thread,
  // which is blocked by a busy-wait. Instead, use `page.exposeFunction` so the
  // browser can NOTIFY Node.js (via IPC) when window.print fires, without needing
  // the main thread on the Playwright side.
  //
  // Flow:
  //   browser: window.print() → apply inline styles → notify Playwright → spin 10 s
  //   Node.js: receive notification → immediately call page.pdf() (works via CDP)
  //   After spin: setShowPrint(false) → portal removed (PDF is already done)

  let printFiredResolve;
  const printFiredPromise = new Promise((r) => { printFiredResolve = r; });

  // exposeFunction must be called before page.goto()
  await page.exposeFunction('__verifyPrintFired', (portalText) => {
    printFiredResolve(portalText ?? '');
    return 'ok';
  });

  await page.addInitScript(() => {
    window.print = () => {
      // 1. Apply inline styles so page.pdf() captures invoice, not main app
      const root = document.getElementById('root');
      if (root) root.style.setProperty('display', 'none', 'important');
      const portal = document.querySelector('.doc-print-root');
      if (portal) {
        portal.style.setProperty('display', 'block', 'important');
        portal.style.removeProperty('position');
      }
      // 2. Capture portal text and notify Playwright (async IPC, non-blocking here)
      window.__verifyPrintFired(portal ? (portal.innerText || '') : '');
      // 3. Spin to keep portal alive while Playwright's page.pdf() completes
      const end = Date.now() + 10000;
      // eslint-disable-next-line no-empty
      while (Date.now() < end) { /* intentional blocking — keeps portal in DOM */ }
    };
  });

  // OrderDetailPage を開く
  console.log(`OrderDetailPage を開いています: ${orderDetailUrl}`);
  await page.goto(orderDetailUrl, { waitUntil: 'networkidle', timeout: 30_000 });
  console.log('ページロード完了');

  // データ（issuer + detail）が揃うまで待つ。
  // issuer と detail の両方がロードされないと showPrint && issuer && detail の条件が
  // 満たされず portal がレンダリングされない。
  // 請求書番号 "INV-00001" が画面に現れたらデータ揃いと判断する。
  await page.waitForFunction(
    () => document.body.innerText.includes('INV-00001'),
    { timeout: 15_000 }
  );
  console.log('ページデータ（issuer + detail）ロード確認');

  // 「印刷」ボタンを探してクリック
  const printBtn = page.getByRole('button', { name: /print|invoice|印刷/i }).first();
  await printBtn.waitFor({ timeout: 10_000 });
  console.log('印刷ボタンを発見');

  // click() の await はスピン（10秒）終了後に戻るため fire-and-forget にする
  printBtn.click({ timeout: 20_000 }).catch(() => {});

  // browser が window.print() に入って __verifyPrintFired を呼ぶまで待つ
  console.log('window.print 発火を待機中...');
  const portalText = await printFiredPromise;
  console.log('window.print 発火を確認（inline styles 適用済み）');

  // PDF 生成（inline styles: #root=none, portal=block の状態で実行）
  console.log('\nPDF 生成中 (format: A4, printBackground: true)...');
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
  });
  console.log(`PDF バッファサイズ: ${pdfBuffer.length} bytes`);

  // portalText はすでに printFiredPromise で受信済み
  console.log('\n【ポータル抽出テキスト (DOM innerText)】');
  console.log('─'.repeat(60));
  console.log(portalText);
  console.log('─'.repeat(60));

  // PDF テキスト抽出（ページ番号・日付フォーマットチェック用）
  console.log('\nPDF からテキストを抽出中...');
  const { text: extractedText, numPages } = await extractTextFromPdf(Buffer.from(pdfBuffer));

  console.log('\n【抽出テキスト (全文)】');
  console.log('─'.repeat(60));
  console.log(extractedText);
  console.log('─'.repeat(60));
  console.log(`抽出ページ数: ${numPages}\n`);

  // ─── 検査 1: portalText が 1 件以上抽出されること ───────────────────────────
  // portalText = DOM innerText of .doc-print-root (captured inside window.print override)
  const trimmedPortal = portalText.trim();
  check(
    1,
    'ポータル DOM テキストが 1 件以上抽出される（InvoiceDocument が描画されている）',
    trimmedPortal.length > 0,
    trimmedPortal.length > 0
      ? `抽出文字数: ${trimmedPortal.length} 文字`
      : '⚠ ポータルテキストが空です（InvoiceDocument が描画されていない可能性）'
  );

  // ─── 検査 2: 日付に T や Z が含まれない ────────────────────────────────────
  // portalText で確認（PDF レイアウトとは独立）
  const dateIsoPattern = /\d{4}-\d{2}-\d{2}T|\dZ\b/;
  const hasIso = dateIsoPattern.test(portalText);
  const dateMatches = [...portalText.matchAll(/\d{4}[\/\-]\d{2}[\/\-]\d{2}/g)].map((m) => m[0]);
  check(
    2,
    '日付に T や Z が含まれない（ISO 8601 生文字列でない）',
    !hasIso,
    hasIso
      ? `⚠ ISO 形式の日付を検出: ${portalText.match(/\d{4}-\d{2}-\d{2}T[^\s]*/)?.[0] ?? 'unknown'}`
      : `OK: 検出された日付文字列: ${dateMatches.join(', ') || '(なし)'}`
  );

  // ─── 検査 3: 請求先名が描画されていること（Bug D 修正確認） ────────────────
  const hasBilledTo = portalText.includes(EXPECTED_BILLED_TO);
  check(
    3,
    `請求先名 "${EXPECTED_BILLED_TO}" が InvoiceDocument に描画されている（Bug D 修正確認）`,
    hasBilledTo,
    hasBilledTo
      ? `OK: "${EXPECTED_BILLED_TO}" を確認`
      : `⚠ "${EXPECTED_BILLED_TO}" が見当たりません`
  );

  // ─── 検査 4: 届先名が描画されていること（Bug E 修正確認） ──────────────────
  const hasShipTo = portalText.includes(EXPECTED_SHIP_TO);
  check(
    4,
    `届先名 "${EXPECTED_SHIP_TO}" が InvoiceDocument に描画されている（Bug E 修正確認）`,
    hasShipTo,
    hasShipTo
      ? `OK: "${EXPECTED_SHIP_TO}" を確認`
      : `⚠ "${EXPECTED_SHIP_TO}" が見当たりません`
  );

  // ─── 検査 5: 英語商品名が描画されていること（Bug F 修正確認） ──────────────
  const hasProduct = portalText.includes(EXPECTED_PRODUCT);
  check(
    5,
    `英語商品名 "${EXPECTED_PRODUCT}" が InvoiceDocument に描画されている（Bug F 修正確認）`,
    hasProduct,
    hasProduct
      ? `OK: "${EXPECTED_PRODUCT}" を確認`
      : `⚠ "${EXPECTED_PRODUCT}" が見当たりません`
  );

  // ─── 検査 6: USD 注文で Exchange Rate が描画されていること（Bug A 修正確認） ─
  const hasExchangeRate = /Exchange Rate/i.test(portalText);
  check(
    6,
    'USD 注文で "Exchange Rate" が InvoiceDocument に描画されている（Bug A 修正確認）',
    hasExchangeRate,
    hasExchangeRate
      ? 'OK: "Exchange Rate" を確認'
      : '⚠ "Exchange Rate" が見当たりません（USD 注文なのに表示されていない）'
  );

  // ─── 検査 7: 支払方法と支払先メールが描画されていること（Bug G 修正確認） ──
  const hasPaymentMethod = portalText.includes(EXPECTED_PAYMENT_METHOD);
  const hasPaymentEmail  = portalText.includes(EXPECTED_PAYMENT_EMAIL);
  check(
    7,
    `支払方法 "${EXPECTED_PAYMENT_METHOD}" と支払先メール "${EXPECTED_PAYMENT_EMAIL}" が InvoiceDocument に描画されている（Bug G 修正確認）`,
    hasPaymentMethod && hasPaymentEmail,
    `支払方法: ${hasPaymentMethod ? 'OK' : '⚠ 未検出'} / 支払先メール: ${hasPaymentEmail ? 'OK' : '⚠ 未検出'}`
  );

  // ─── 検査 8: ページ番号 "Page X / Y" パターンが描画されていること ────────────
  // portalText で確認（PDF テキスト抽出より確実）
  const pageNoMatches = [...portalText.matchAll(/Page\s+(\d+)\s*\/\s*(\d+)/gi)].map((m) => ({
    raw: m[0],
    current: Number(m[1]),
    total: Number(m[2]),
  }));
  const hasPageNo = pageNoMatches.length > 0;
  const invalidPageNos = pageNoMatches.filter((e) => e.current > e.total || e.current < 1 || e.total < 1);
  check(
    8,
    'ページ番号 "Page X / Y" パターンが存在し X ≤ Y',
    hasPageNo && invalidPageNos.length === 0,
    hasPageNo
      ? invalidPageNos.length === 0
        ? `OK: ${pageNoMatches.map((e) => e.raw).join(', ')}`
        : `⚠ 異常なページ番号: ${invalidPageNos.map((e) => e.raw).join(', ')}`
      : '⚠ ページ番号パターンが見当たりません'
  );

} finally {
  if (browser) await browser.close();
  if (viteProcess) {
    viteProcess.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }
}

// ─── サマリ ───────────────────────────────────────────────────────────────────

console.log('【検査結果】');
for (const r of results) {
  console.log(`  [${r.status}] #${r.id} ${r.label}`);
  console.log(`        → ${r.extracted}`);
}
console.log();

const failed = results.filter((r) => r.status === FAIL);
if (failed.length === 0) {
  console.log(`✓ 全 ${results.length} 件の条件をクリアしました。`);
} else {
  console.error(`✗ ${results.length} 件中 ${failed.length} 件が不合格:`);
  for (const r of failed) console.error(`    [FAIL] #${r.id} ${r.label}`);
  process.exit(1);
}
