const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/26_Triggers.js', 'utf8');

const CONFIG = {
  SHEETS: {
    LEADS: 'リード管理',
    LEADS_IN: 'リード管理（受信）',
    LEADS_OUT: 'リード管理（送信）',
    STAFF: '担当者マスタ'
  }
};

// スタブ: 26_Triggers.js が参照するが autoFillStaffId と無関係な関数
const stubs = {
  CONFIG,
  Logger: { log: () => {} },
  updateSheetTimestamp: () => {},
  updateProspectRankOnEdit: () => {},
  archiveOnStatusChange: () => {}
};

function makeLeadSheet(headers, rows, writes) {
  return {
    getName: () => CONFIG.SHEETS.LEADS_IN,
    getLastColumn: () => headers.length,
    getRange: (row, col, rowCount, colCount) => {
      if (rowCount === undefined) {
        // single-cell write
        return { setValue: value => writes.push({ row, col, value }) };
      }
      // header read
      return { getValues: () => [headers] };
    }
  };
}

function makeStaffSheet(staffRows) {
  return {
    getLastRow: () => staffRows.length,
    getDataRange: () => ({ getValues: () => staffRows })
  };
}

function makeEvent(sheet, staffSheet, editedRow, editedCol, value) {
  return {
    source: {
      getActiveSheet: () => sheet,
      getSheetByName: name => name === CONFIG.SHEETS.STAFF ? staffSheet : null
    },
    range: { getRow: () => editedRow, getColumn: () => editedCol },
    value
  };
}

function run(overrides) {
  const context = vm.createContext(Object.assign({}, stubs, overrides));
  vm.runInContext(source, context, { filename: '26_Triggers.js' });
  return context;
}

// --- ケース1: 新形式（苗字/名前）で担当者ID（LDO形式）が書き込まれる ---
{
  const writes = [];
  const headers = ['担当者', '担当者ID', 'その他'];
  const staffRows = [
    ['担当者ID', '苗字（日本語）', '名前（日本語）', 'Discord ID'],
    ['LDO-0001', '山田', '太郎', '123456789012345678']
  ];
  const sheet = makeLeadSheet(headers, [], writes);
  const staffSheet = makeStaffSheet(staffRows);
  const e = makeEvent(sheet, staffSheet, 2, 1, '山田 太郎');

  run({}).autoFillStaffId(e);

  assert.equal(writes.length, 1, 'ケース1: 書き込みが1回行われる');
  assert.equal(writes[0].row, 2, 'ケース1: 正しい行');
  assert.equal(writes[0].col, 2, 'ケース1: 担当者ID列(col=2)に書き込む');
  assert.equal(writes[0].value, 'LDO-0001', 'ケース1: LDO形式のSTAFF_IDが書き込まれる');
}

// --- ケース2: 旧形式（氏名統合）でも同様に動作する ---
{
  const writes = [];
  const headers = ['担当者', '担当者ID'];
  const staffRows = [
    ['担当者ID', '氏名（日本語）', 'Discord ID'],
    ['LDO-0002', '鈴木花子', '987654321098765432']
  ];
  const sheet = makeLeadSheet(headers, [], writes);
  const staffSheet = makeStaffSheet(staffRows);
  const e = makeEvent(sheet, staffSheet, 3, 1, '鈴木花子');

  run({}).autoFillStaffId(e);

  assert.equal(writes.length, 1, 'ケース2: 書き込みが1回行われる');
  assert.equal(writes[0].value, 'LDO-0002', 'ケース2: LDO形式のSTAFF_IDが書き込まれる');
}

// --- ケース3: Discord IDが入っていても書き込まれない（Staff_IDが書き込まれる） ---
// 修正後のコードは Discord ID 列を参照しないため、Discord ID の値は無関係
{
  const writes = [];
  const headers = ['担当者', '担当者ID'];
  const staffRows = [
    ['担当者ID', '苗字（日本語）', '名前（日本語）', 'Discord ID'],
    ['LDO-0003', '田中', '一郎', '111222333444555666']
  ];
  const sheet = makeLeadSheet(headers, [], writes);
  const staffSheet = makeStaffSheet(staffRows);
  const e = makeEvent(sheet, staffSheet, 4, 1, '田中 一郎');

  run({}).autoFillStaffId(e);

  assert.equal(writes.length, 1, 'ケース3: 書き込みが1回行われる');
  assert.equal(writes[0].value, 'LDO-0003', 'ケース3: Discord IDではなくSTAFF_IDが書き込まれる');
  assert.notEqual(writes[0].value, '111222333444555666', 'ケース3: Discord IDは書き込まれない');
}

// --- ケース4: 担当者マスタに担当者ID列がない場合は何も書き込まない ---
{
  const writes = [];
  const headers = ['担当者', '担当者ID'];
  const staffRows = [
    ['氏名（日本語）', 'Discord ID'],  // 担当者ID列なし
    ['山田太郎', '123456789012345678']
  ];
  const sheet = makeLeadSheet(headers, [], writes);
  const staffSheet = makeStaffSheet(staffRows);
  const e = makeEvent(sheet, staffSheet, 2, 1, '山田太郎');

  run({}).autoFillStaffId(e);

  assert.equal(writes.length, 0, 'ケース4: 担当者ID列がない場合は書き込みなし');
}

// --- ケース5: 名前が一致しない場合は何も書き込まない ---
{
  const writes = [];
  const headers = ['担当者', '担当者ID'];
  const staffRows = [
    ['担当者ID', '氏名（日本語）'],
    ['LDO-0001', '登録済み担当者']
  ];
  const sheet = makeLeadSheet(headers, [], writes);
  const staffSheet = makeStaffSheet(staffRows);
  const e = makeEvent(sheet, staffSheet, 2, 1, '未登録担当者');

  run({}).autoFillStaffId(e);

  assert.equal(writes.length, 0, 'ケース5: 名前不一致は書き込みなし');
}

// --- ケース6: LEADS_OUTシートでも動作する ---
{
  const writes = [];
  const headers = ['担当者', '担当者ID'];
  const staffRows = [
    ['担当者ID', '氏名（日本語）'],
    ['LDO-0005', '佐藤次郎']
  ];
  const sheet = {
    getName: () => CONFIG.SHEETS.LEADS_OUT,
    getLastColumn: () => headers.length,
    getRange: (row, col, rowCount) => {
      if (rowCount === undefined) return { setValue: value => writes.push({ row, col, value }) };
      return { getValues: () => [headers] };
    }
  };
  const staffSheet = makeStaffSheet(staffRows);
  const e = makeEvent(sheet, staffSheet, 2, 1, '佐藤次郎');

  run({}).autoFillStaffId(e);

  assert.equal(writes.length, 1, 'ケース6: LEADS_OUTでも書き込まれる');
  assert.equal(writes[0].value, 'LDO-0005', 'ケース6: LDO形式のSTAFF_IDが書き込まれる');
}

// --- ケース7: LEADS（統合シート）では動作しない ---
{
  const writes = [];
  const headers = ['担当者', '担当者ID'];
  const staffRows = [['担当者ID', '氏名（日本語）'], ['LDO-0001', '山田太郎']];
  const sheet = {
    getName: () => CONFIG.SHEETS.LEADS,  // リード管理（対象外）
    getLastColumn: () => headers.length,
    getRange: (row, col, rowCount) => {
      if (rowCount === undefined) return { setValue: value => writes.push({ row, col, value }) };
      return { getValues: () => [headers] };
    }
  };
  const staffSheet = makeStaffSheet(staffRows);
  const e = makeEvent(sheet, staffSheet, 2, 1, '山田太郎');

  run({}).autoFillStaffId(e);

  assert.equal(writes.length, 0, 'ケース7: 統合シートでは書き込みなし');
}

// --- ケース8: ヘッダー行（row=1）の編集は無視 ---
{
  const writes = [];
  const headers = ['担当者', '担当者ID'];
  const staffRows = [['担当者ID', '氏名（日本語）'], ['LDO-0001', '山田太郎']];
  const sheet = makeLeadSheet(headers, [], writes);
  const staffSheet = makeStaffSheet(staffRows);
  const e = makeEvent(sheet, staffSheet, 1, 1, '山田太郎');  // row=1

  run({}).autoFillStaffId(e);

  assert.equal(writes.length, 0, 'ケース8: ヘッダー行は無視');
}

// --- ソース内に Discord ID の読み取りコードが残っていないことを確認 ---
{
  // 修正後のコードは 'Discord ID' を indexOf で検索すべきでない
  assert.equal(
    source.includes("indexOf('Discord ID')"),
    false,
    'ソース: Discord ID を indexOf で検索するコードが残っていない'
  );
  // discordId または discordCol という変数名が残っていないことを確認
  assert.equal(
    /\bdiscordId\b/.test(source),
    false,
    'ソース: discordId 変数が残っていない'
  );
  assert.equal(
    /\bdiscordCol\b/.test(source),
    false,
    'ソース: discordCol 変数が残っていない'
  );
}

console.log('PASS: autoFillStaffId unit checks (STAFF_ID lookup)');
