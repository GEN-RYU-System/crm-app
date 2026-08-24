#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const textExtensions = /\.(?:md|txt|js|mjs|cjs|ts|tsx|jsx|json|ya?ml|html|css)$/i;
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((file) => file && textExtensions.test(file) && !file.startsWith('frontend/dist/') && !file.startsWith('docs/SHA_REMAP_'));
const baseSha = process.env.SENSITIVE_CONTENT_BASE_SHA;
const files = baseSha
  ? execFileSync('git', ['diff', '--name-only', '-z', `${baseSha}...HEAD`], { encoding: 'utf8' })
      .split('\0')
      .filter((file) => trackedFiles.includes(file))
  : trackedFiles;

const violations = [];
const isDocsOrTest = (file) => file.startsWith('docs/') || /(^|\/)(test|tests|__tests__|fixtures)(\/|[-_.])/i.test(file) || /(^|\/)test[_-]/i.test(file);
const safeEmailDomains = new Set(['example.com', 'example.org', 'example.net', 'invalid', 'test', 'localhost']);
const safePhone = /^(?:0{2,}|1{2,}|2{2,}|9{2,}|123(?:[- ]?456){1,2})/;
const safeCustomerValues = new Set(['test customer', 'example customer', 'sample customer', 'customer a', 'customer b', '顧客a', '顧客b', 'サンプル顧客', 'テスト顧客']);

function add(file, line, kind, value) {
  violations.push(`${file}:${line}: ${kind}: ${value}`);
}

for (const file of files) {
  const body = readFileSync(resolve(file), 'utf8');
  const lines = body.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const location = index + 1;
    for (const match of line.matchAll(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi)) {
      const domain = match[1].toLowerCase();
      if (!safeEmailDomains.has(domain)) add(file, location, '実メールアドレスの可能性', match[0]);
    }
    for (const match of line.matchAll(/(?:\+?\d{1,3}[-. ]?)?(?:\(?\d{2,4}\)?[-. ]?){2,3}\d{3,4}/g)) {
      const digits = match[0].replace(/\D/g, '');
      if (digits.length >= 10 && !safePhone.test(digits)) add(file, location, '実電話番号の可能性', match[0]);
    }
    for (const match of line.matchAll(/(?:docs\.google\.com\/(?:spreadsheets|document)\/d\/|drive\.google\.com\/(?:drive\/folders\/|open\?id=))([A-Za-z0-9_-]{25,})/g)) {
      add(file, location, 'Google Sheets/Drive ID', match[1]);
    }
    for (const match of line.matchAll(/(?:spreadsheet|drive)[_-]?id\s*[:=]\s*["']?([A-Za-z0-9_-]{25,})/gi)) {
      add(file, location, 'Spreadsheet/Drive ID', match[1]);
    }
    if (isDocsOrTest(file)) {
      const customer = /(?:customerName|customer_name|顧客名)\s*[:=]\s*["'`]([^"'`]+)["'`]/i.exec(line);
      if (customer && !safeCustomerValues.has(customer[1].trim().toLowerCase())) {
        add(file, location, 'docs/テスト内の顧客名（明示ダミー以外）', customer[1]);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Sensitive content check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Sensitive content check passed (${files.length} tracked text files).`);
