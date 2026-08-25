#!/usr/bin/env node
/**
 * verify-invoice-print.mjs
 *
 * InvoiceDocument / QuoteDocument の静的解析による健全性検証スクリプト。
 * 以下の 7 条件を検査し、抽出値を報告する。
 *
 *  1. 日付形式が YYYY/MM/DD（ゼロ埋め）であること
 *  2. formatDate が Asia/Tokyo タイムゾーン + month/day 2-digit を使用していること
 *  3. JPY 請求書に exchangeRate が設定されていないこと
 *  4. InvoiceDocument が Billed-to（DocParties）を描画すること
 *  5. Ship-to（DocParties）が複数行を描画すること
 *  6. 支払条件（DocTerms）が最終ページのみに描画されること (isLast)
 *  7. ページ番号 "Page X / Y" パターンが存在すること
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const frontendSrc = resolve(repoRoot, 'frontend', 'src');

const PASS = 'PASS';
const FAIL = 'FAIL';
const results = [];

function check(id, label, condition, extracted) {
  const status = condition ? PASS : FAIL;
  results.push({ id, status, label, extracted });
}

// ─── ソースを読み込む ──────────────────────────────────────────────────────────

const catalogSource = await readFile(
  resolve(frontendSrc, 'pages/catalog/ComponentCatalogPage.tsx'),
  'utf8'
);
const invoiceDocSource = await readFile(
  resolve(frontendSrc, 'features/documents/InvoiceDocument.tsx'),
  'utf8'
);
const docPartsSource = await readFile(
  resolve(frontendSrc, 'features/documents/DocumentParts.tsx'),
  'utf8'
);
const dateFormatSource = await readFile(
  resolve(frontendSrc, 'pages/shared/dateFormat.ts'),
  'utf8'
);

// ─── カタログから InvoiceDocument の props を抽出 ──────────────────────────────

// JSX テキスト中の date="..." / dueDate="..." / currency="..." / exchangeRate="..." を収集
const dateProps    = [...catalogSource.matchAll(/\bdate="([^"]+)"/g)].map(m => m[1]);
const dueDateProps = [...catalogSource.matchAll(/\bdueDate="([^"]+)"/g)].map(m => m[1]);
const validUntilProps = [...catalogSource.matchAll(/\bvalidUntil="([^"]+)"/g)].map(m => m[1]);
const currencyProps    = [...catalogSource.matchAll(/\bcurrency="([^"]+)"/g)].map(m => m[1]);
const exchangeRateProps = [...catalogSource.matchAll(/\bexchangeRate="([^"]+)"/g)].map(m => m[1]);

// InvoiceDocument ブロックを <InvoiceDocument ... /> で分割（セルフクローズ）
const invoiceBlocks = [...catalogSource.matchAll(/<InvoiceDocument[\s\S]*?\/>/g)].map(m => m[0]);
const jpyBlocks     = invoiceBlocks.filter(b => b.includes('currency="JPY"'));
const jpyWithRate   = jpyBlocks.filter(b => b.includes('exchangeRate='));

// ─── 抽出テキスト報告 ─────────────────────────────────────────────────────────

console.log('=== verify-invoice-print.mjs ===\n');
console.log('【抽出テキスト】');
console.log('  date props      :', dateProps);
console.log('  dueDate props   :', dueDateProps);
console.log('  validUntil props:', validUntilProps);
console.log('  currency props  :', currencyProps);
console.log('  exchangeRate    :', exchangeRateProps);
console.log(`  InvoiceDocument ブロック数: ${invoiceBlocks.length} (JPY: ${jpyBlocks.length})`);
console.log();

// ─── 検査 1: 日付形式 YYYY/MM/DD（ゼロ埋め） ──────────────────────────────────

const dateRegex = /^\d{4}\/\d{2}\/\d{2}$/;
const allDocDates = [...dateProps, ...dueDateProps, ...validUntilProps].filter(Boolean);
const invalidDates = allDocDates.filter(d => !dateRegex.test(d));
check(
  1,
  '日付形式が YYYY/MM/DD（ゼロ埋め）である',
  invalidDates.length === 0,
  invalidDates.length > 0
    ? `不正な値: ${invalidDates.join(', ')}`
    : `全 ${allDocDates.length} 件が正常: ${allDocDates.join(', ')}`
);

// ─── 検査 2: formatDate が Asia/Tokyo + 2-digit を使用 ────────────────────────

const usesTokyo    = dateFormatSource.includes('Asia/Tokyo');
const usesMonthPad = dateFormatSource.includes("month: '2-digit'");
const usesDayPad   = dateFormatSource.includes("day: '2-digit'");
check(
  2,
  'formatDate が Asia/Tokyo + month/day 2-digit を使用している',
  usesTokyo && usesMonthPad && usesDayPad,
  `Asia/Tokyo=${usesTokyo}, month 2-digit=${usesMonthPad}, day 2-digit=${usesDayPad}`
);

// ─── 検査 3: JPY 請求書に exchangeRate なし ────────────────────────────────────

check(
  3,
  'JPY 請求書に exchangeRate が設定されていない',
  jpyWithRate.length === 0,
  jpyWithRate.length === 0
    ? `JPY ${jpyBlocks.length} 件、全て exchangeRate なし`
    : `⚠ JPY でも exchangeRate が設定されているブロック: ${jpyWithRate.length} 件`
);

// ─── 検査 4: Billed-to（DocParties + billedTo prop） ─────────────────────────

const hasBilledTo = invoiceDocSource.includes('DocParties') && invoiceDocSource.includes('billedTo');
check(
  4,
  'InvoiceDocument が Billed-to（DocParties）を描画する',
  hasBilledTo,
  hasBilledTo ? 'DocParties と billedTo を確認' : '⚠ DocParties または billedTo が見当たりません'
);

// ─── 検査 5: Ship-to（DocParties + shipTo lines） ────────────────────────────

const hasShipTo = invoiceDocSource.includes('shipTo') && docPartsSource.includes('DocParties');
const docPartiesRendersLines =
  docPartsSource.includes('party.lines') && docPartsSource.includes('party.lines.map');
check(
  5,
  'Ship-to が複数行を描画する（DocParties lines.map）',
  hasShipTo && docPartiesRendersLines,
  hasShipTo && docPartiesRendersLines
    ? 'shipTo と party.lines.map を確認'
    : '⚠ ship-to 複数行描画が見当たりません'
);

// ─── 検査 6: 支払条件（DocTerms）が最終ページのみ ─────────────────────────────

const hasDocTerms      = invoiceDocSource.includes('DocTerms');
const docTermsInIsLast = /isLast[\s\S]{0,2000}DocTerms/.test(invoiceDocSource);
check(
  6,
  '支払条件（DocTerms）が最終ページのみに描画される (isLast)',
  hasDocTerms && docTermsInIsLast,
  hasDocTerms && docTermsInIsLast
    ? 'isLast 条件内に DocTerms を確認'
    : '⚠ DocTerms が isLast 条件外かもしれません'
);

// ─── 検査 7: ページ番号 "Page X / Y" ─────────────────────────────────────────

const hasPageNo    = invoiceDocSource.includes('pageNo');
const hasTotalPages = invoiceDocSource.includes('totalPages');
const hasPageLabel  = invoiceDocSource.includes('Page');
check(
  7,
  'ページ番号 "Page {pageNo} / {totalPages}" パターンが存在する',
  hasPageNo && hasTotalPages && hasPageLabel,
  hasPageNo && hasTotalPages
    ? 'pageNo と totalPages を確認（"Page X / Y" 形式）'
    : '⚠ ページ番号パターンが見当たりません'
);

// ─── サマリ ───────────────────────────────────────────────────────────────────

console.log('【検査結果】');
for (const r of results) {
  console.log(`  [${r.status}] #${r.id} ${r.label}`);
  console.log(`        → ${r.extracted}`);
}
console.log();

const failed = results.filter(r => r.status === FAIL);
if (failed.length === 0) {
  console.log(`✓ 全 ${results.length} 件の条件をクリアしました。`);
} else {
  console.error(`✗ ${results.length} 件中 ${failed.length} 件が不合格:`);
  for (const r of failed) console.error(`    [FAIL] #${r.id} ${r.label}`);
  process.exit(1);
}
