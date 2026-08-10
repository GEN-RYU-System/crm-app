/**
 * テスト用関数
 */

// 列名（A, B, C, ..., AA, AB, ...）を生成するヘルパー
function getColumnName(index) {
  let name = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

/**
 * リード管理シートのヘッダー情報を取得
 */
function getLeadsSheetHeaders() {
  try {
    const spreadsheetId = getERPSpreadsheetId();
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('リード管理');

    if (!sheet) {
      return {
        error: 'リード管理シートが存在しません',
        availableSheets: ss.getSheets().map(s => s.getName())
      };
    }

    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) {
      return {
        error: 'リード管理シートにデータがありません'
      };
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    return {
      totalColumns: headers.length,
      headers: headers.map((h, i) => ({
        column: getColumnName(i + 1),
        index: i + 1,
        name: h
      }))
    };
  } catch (e) {
    return {
      error: e.message,
      stack: e.stack
    };
  }
}

/**
 * 商談管理シートのヘッダー情報を取得
 */
function getDealsSheetHeaders() {
  try {
    const spreadsheetId = getERPSpreadsheetId();
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('商談管理');

    if (!sheet) {
      return {
        error: '商談管理シートが存在しません',
        availableSheets: ss.getSheets().map(s => s.getName())
      };
    }

    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) {
      return {
        error: '商談管理シートにデータがありません'
      };
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    return {
      totalColumns: headers.length,
      headers: headers.map((h, i) => ({
        column: getColumnName(i + 1),
        index: i + 1,
        name: h
      }))
    };
  } catch (e) {
    return {
      error: e.message,
      stack: e.stack
    };
  }
}

/**
 * 全シート名を取得
 */
function getAllSheetNames() {
  try {
    const spreadsheetId = getERPSpreadsheetId();
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheets = ss.getSheets();

    return {
      spreadsheetName: ss.getName(),
      spreadsheetId: ss.getId(),
      totalSheets: sheets.length,
      sheets: sheets.map(s => ({
        name: s.getName(),
        id: s.getSheetId(),
        rows: s.getLastRow(),
        columns: s.getLastColumn()
      }))
    };
  } catch (e) {
    return {
      error: e.message,
      stack: e.stack
    };
  }
}

/**
 * 担当者マスタのデータを取得
 */
function checkStaffData() {
  try {
    const spreadsheetId = getERPSpreadsheetId();
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('担当者マスタ');

    if (!sheet) {
      return { error: '担当者マスタシートが存在しません' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    return {
      totalRows: data.length,
      headers: headers,
      data: data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      })
    };
  } catch (e) {
    return { error: e.message, stack: e.stack };
  }
}

/**
 * Web App URL を環境情報付きで取得（デバッグ用）
 * NOTE: getWebAppUrl() は 08_Config_WebAppURL.js が正本。この関数は名前衝突を避けるため inspectWebAppUrl に改名。
 */
function inspectWebAppUrl() {
  try {
    const url = ScriptApp.getService().getUrl();
    return {
      url: url,
      environment: getERPEnvironment(),
      spreadsheetId: getERPSpreadsheetId()
    };
  } catch (e) {
    return { error: e.message, stack: e.stack };
  }
}

/**
 * doGet関数のテスト実行
 */
function testDoGet() {
  try {
    const mockEvent = {
      parameter: {},
      queryString: ''
    };
    const result = doGet(mockEvent);
    return {
      success: true,
      resultType: typeof result,
      hasEvaluate: typeof result.evaluate === 'function',
      title: result.getTitle ? result.getTitle() : 'N/A'
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      stack: e.stack,
      line: e.lineNumber
    };
  }
}

/**
 * 顧客マスタ・配送先マスタ・支払先マスタの Country 列が
 * 国マスタ（国名（表示）列）に全て存在することを検証
 * @returns {string} 検証レポート
 */
function verifyLedgerCountries() {
  var ss = getSpreadsheet();
  var masterSh = ss.getSheetByName('国マスタ');
  var lines = ['=== verifyLedgerCountries ==='];

  if (!masterSh) {
    return lines.concat(['ERROR: 国マスタが存在しません']).join('\n');
  }

  var masterData = masterSh.getDataRange().getValues();
  var mh = masterData[0];
  var nameIdx = mh.indexOf('国名（表示）');
  if (nameIdx < 0) {
    return lines.concat(['ERROR: 国名（表示）列が見つかりません']).join('\n');
  }

  var masterNames = {};
  masterData.slice(1).forEach(function(r) {
    var n = String(r[nameIdx] || '').trim();
    if (n) masterNames[n] = true;
  });
  lines.push('国マスタ件数: ' + Object.keys(masterNames).length);
  lines.push('');

  var targets = [
    { sheet: '顧客マスタ',   col: '国' },
    { sheet: '配送先マスタ', col: '国' },
    { sheet: '支払先マスタ', col: '国' }
  ];

  var totalMismatch = 0;

  targets.forEach(function(t) {
    var sh = ss.getSheetByName(t.sheet);
    if (!sh) { lines.push('[' + t.sheet + '] シートが存在しません'); return; }
    var data = sh.getDataRange().getValues();
    var h = data[0];
    var ci = h.indexOf(t.col);
    if (ci < 0) {
      lines.push('[' + t.sheet + '] ' + t.col + ' 列なし（ヘッダー: ' + h.slice(0,10).join('|') + '）');
      return;
    }
    var mismatches = [];
    data.slice(1).forEach(function(r, ri) {
      var v = String(r[ci] || '').trim();
      if (v && !masterNames[v]) {
        mismatches.push('  行' + (ri + 2) + ': "' + v + '"');
      }
    });
    var nonEmpty = data.slice(1).filter(function(r) { return String(r[ci] || '').trim(); }).length;
    lines.push('[' + t.sheet + '] Country列: ' + nonEmpty + '件 / 不一致: ' + mismatches.length + '件');
    mismatches.forEach(function(m) { lines.push(m); });
    totalMismatch += mismatches.length;
  });

  lines.push('');
  lines.push('合計不一致: ' + totalMismatch + '件' + (totalMismatch === 0 ? ' ✓' : ' ✗'));
  return lines.join('\n');
}

/**
 * 台帳の '国' 列にある非標準値を国マスタの正規英語名に修正する（冪等）
 * 修正マップ: 旧値 → 国マスタ上の正しい値
 * @returns {string} 修正ログ
 */
function fixLedgerCountryMismatches() {
  var CORRECTION_MAP = {
    'United states of america': 'United States',
    'United states':            'United States',
    'Root (Hong Kong)':         'Hong Kong'
  };

  var ss = getSpreadsheet();
  var lines = ['=== fixLedgerCountryMismatches ==='];
  var totalFixed = 0;

  var targets = [
    { sheet: '顧客マスタ',   col: '国' },
    { sheet: '配送先マスタ', col: '国' },
    { sheet: '支払先マスタ', col: '国' }
  ];

  targets.forEach(function(t) {
    var sh = ss.getSheetByName(t.sheet);
    if (!sh) { lines.push('[' + t.sheet + '] シートが存在しません'); return; }
    var data = sh.getDataRange().getValues();
    var h = data[0];
    var ci = h.indexOf(t.col);
    if (ci < 0) { lines.push('[' + t.sheet + '] ' + t.col + ' 列なし'); return; }

    var sheetFixed = 0;
    for (var i = 1; i < data.length; i++) {
      var v = String(data[i][ci] || '').trim();
      if (CORRECTION_MAP[v]) {
        var newVal = CORRECTION_MAP[v];
        sh.getRange(i + 1, ci + 1).setValue(newVal);
        lines.push('  ' + t.sheet + ' 行' + (i + 1) + ': "' + v + '" → "' + newVal + '"');
        sheetFixed++;
        totalFixed++;
      }
    }
    if (sheetFixed === 0) lines.push('[' + t.sheet + '] 修正対象なし ✓');
  });

  lines.push('');
  lines.push('合計修正: ' + totalFixed + '件');
  return lines.join('\n');
}

/**
 * 台帳修正4件の ID 確認（fixLedgerCountryMismatches 適用後）
 */
function getFixedRowIds() {
  var ss = getSpreadsheet();
  var checks = [
    { sheet: '顧客マスタ',   rowNum: 20, idCol: '顧客ID',  after: 'United States' },
    { sheet: '配送先マスタ', rowNum: 17, idCol: '配送先ID', after: 'Hong Kong' },
    { sheet: '配送先マスタ', rowNum: 39, idCol: '配送先ID', after: 'United States' },
    { sheet: '支払先マスタ', rowNum: 20, idCol: '支払先ID', after: 'United States' }
  ];
  return checks.map(function(c) {
    var sh = ss.getSheetByName(c.sheet);
    if (!sh) return { sheet: c.sheet, error: 'not found' };
    var data = sh.getDataRange().getValues();
    var h = data[0];
    var idIdx  = h.indexOf(c.idCol);
    var cidIdx = h.indexOf('顧客ID');
    var natIdx = h.indexOf('国');
    var r = data[c.rowNum - 1];
    return {
      sheet:      c.sheet,
      row:        c.rowNum,
      id:         idIdx  >= 0 ? r[idIdx]  : '?',
      customerId: cidIdx >= 0 ? r[cidIdx] : '?',
      current:    natIdx >= 0 ? r[natIdx] : '?',
      after:      c.after
    };
  });
}

/**
 * 任意マスタの特定行を全列ヘッダー付きでダンプ（列ずれ・値確認用）
 * @param {string} sheetName  - シート名（例: '配送先マスタ'）
 * @param {string} idHeader   - 検索列名（例: '配送先ID'）
 * @param {string} idValue    - 検索値（例: 'AD-00053'）
 * @returns {Object} { found, totalCols, headers, row, types }
 */
function dumpMasterRow(sheetName, idHeader, idValue) {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { error: sheetName + ' が存在しません' };
  var data = sh.getDataRange().getValues();
  var h    = data[0];
  var idIdx = h.indexOf(idHeader);
  if (idIdx < 0) return { error: idHeader + ' 列が見つかりません (headers: ' + h.slice(0, 10).join('|') + ')' };

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]).trim() !== String(idValue).trim()) continue;
    var row   = {};
    var types = {};
    h.forEach(function(col, ci) {
      var label = 'col' + (ci + 1) + ':' + (col || '(空)');
      row[label]   = data[i][ci];
      types[label] = typeof data[i][ci];
    });
    return { found: true, sheet: sheetName, totalCols: h.length, headers: h, row: row, types: types };
  }
  return { found: false, sheet: sheetName, idHeader: idHeader, idValue: idValue };
}

/**
 * 支払先マスタの特定行を全列ヘッダー付きでダンプ（列ずれ診断用）
 * @param {string} payId - 'PY-XXXXX'
 * @returns {Object} { totalCols, headers, row, types }
 */
function dumpPayeeRow(payId) {
  return dumpMasterRow(CONFIG.SHEETS.CRM_PAYMENT, '支払先ID', payId);
}

/**
 * 実弾テストデータ削除（DRY RUN / CONFIRM 2段式）
 *
 * DRY RUN  : 削除予定行の ID・主要値を一覧表示。シートは変更しない。
 * CONFIRM  : 実際に削除し、事後行数 + verifyCustomerByLeadId で復帰確認。
 *
 * 削除対象（固定）:
 *   顧客マスタ    CT-00053
 *   配送先マスタ  AD-00052
 *   支払先マスタ  PY-00052
 *   フォームトークン  リードID=LDI-00235 の全行（2行）
 *   リード管理    LDI-00235（TEST FORM CHECK）
 *
 * @param {string} mode - 'DRY_RUN'（省略可・デフォルト）または 'CONFIRM'
 * @returns {string} 実行ログ
 */
function cleanupFormTestData(mode) {
  var isConfirm = String(mode || '').trim().toUpperCase() === 'CONFIRM';
  var ss = getSpreadsheet();
  var lines = ['=== cleanupFormTestData [' + (isConfirm ? 'CONFIRM' : 'DRY RUN') + '] ===', ''];

  // ---------- 削除対象定義 ----------
  // matchCol: 検索列  matchVals: 一致値  idCol: ログ用ID列（matchColと異なる場合）
  // keyCol: ログ用補助列  extraCols: ログに追記する補助列リスト
  var targets = [
    {
      sheet: CONFIG.SHEETS.CRM_CUSTOMERS,
      matchCol: '顧客ID',  matchVals: ['CT-00053'],
      idCol:    '顧客ID',  keyCol: '顧客名',
      label: '顧客マスタ', expectedDataRows: 51
    },
    {
      // 配送先: 顧客ID = CT-00053 に紐づく全行を動的収集
      sheet: CONFIG.SHEETS.CRM_SHIPPING,
      matchCol: '顧客ID',  matchVals: ['CT-00053'],
      idCol:    '配送先ID', keyCol: '宛名',
      extraCols: ['国', 'City'],
      label: '配送先マスタ', expectedDataRows: 51
    },
    {
      // 支払先: 顧客ID = CT-00053 に紐づく全行を動的収集
      sheet: CONFIG.SHEETS.CRM_PAYMENT,
      matchCol: '顧客ID',  matchVals: ['CT-00053'],
      idCol:    '支払先ID', keyCol: '請求名義',
      extraCols: ['国', 'City'],
      label: '支払先マスタ', expectedDataRows: 51
    },
    {
      sheet: FORM_TOKEN_SHEET,
      matchCol: 'リードID', matchVals: ['LDI-00235'],
      idCol:    'リードID', keyCol: 'トークン',
      label: 'フォームトークン', expectedDataRows: 0
    },
    {
      sheet: CONFIG.SHEETS.LEADS,
      matchCol: 'リードID', matchVals: ['LDI-00235'],
      idCol:    'リードID', keyCol: '顧客名',
      label: 'リード管理', expectedDataRows: null  // 行数検証なし
    }
  ];

  var totalFound = 0;

  targets.forEach(function(t) {
    var sh = ss.getSheetByName(t.sheet);
    if (!sh) { lines.push('[' + t.label + '] シートなし'); return; }

    var data     = sh.getDataRange().getValues();
    var h        = data[0];
    var matchIdx = h.indexOf(t.matchCol);
    var idIdx    = h.indexOf(t.idCol);
    var keyIdx   = h.indexOf(t.keyCol);
    if (matchIdx < 0) { lines.push('[' + t.label + '] ' + t.matchCol + ' 列なし'); return; }

    // 対象行を収集
    var toDelete = [];
    for (var i = 1; i < data.length; i++) {
      var matchVal = String(data[i][matchIdx] || '').trim();
      if (t.matchVals.indexOf(matchVal) < 0) continue;
      var rowId  = idIdx  >= 0 ? String(data[i][idIdx]  || '') : '?';
      var keyVal = keyIdx >= 0 ? String(data[i][keyIdx] || '') : '?';
      var extras = (t.extraCols || []).map(function(col) {
        var ci = h.indexOf(col);
        return col + '=' + (ci >= 0 ? String(data[i][ci] || '') : '?');
      });
      toDelete.push({ rowNum: i + 1, id: rowId, key: keyVal, extras: extras });
    }

    lines.push('[' + t.label + '] ' + toDelete.length + '行対象');
    toDelete.forEach(function(r) {
      var extra = r.extras.length ? ' [' + r.extras.join(', ') + ']' : '';
      lines.push('  行' + r.rowNum + ': ' + r.id + ' / ' + t.keyCol + '="' + r.key + '"' + extra);
    });
    totalFound += toDelete.length;

    if (isConfirm) {
      // 下から削除（行ズレ防止）
      for (var d = toDelete.length - 1; d >= 0; d--) {
        sh.deleteRow(toDelete[d].rowNum);
      }
      lines.push('  削除実行 ✓');
    } else {
      lines.push('  → DRY RUN: 変更なし');
    }
    lines.push('');
  });

  lines.push('合計 ' + totalFound + '行 ' + (isConfirm ? '削除完了' : '削除予定（DRY RUN）'));

  // ---------- CONFIRM 後の事後検証 ----------
  if (isConfirm) {
    lines.push('');
    lines.push('=== 事後検証 ===');

    // 行数チェック
    targets.forEach(function(t) {
      if (t.expectedDataRows === null) return;
      var sh = ss.getSheetByName(t.sheet);
      if (!sh) { lines.push('[' + t.label + '] シートなし'); return; }
      var dataRows = Math.max(0, sh.getLastRow() - 1);
      var ok = dataRows === t.expectedDataRows;
      lines.push('[' + t.label + '] データ行数: ' + dataRows +
                 '行 (期待: ' + t.expectedDataRows + ')' + (ok ? ' ✓' : ' ✗'));
    });

    // verifyCustomerByLeadId で全タブ0件確認
    lines.push('');
    lines.push('[verifyCustomerByLeadId LDI-00235]');
    try {
      var result = verifyCustomerByLeadId('LDI-00235');
      lines.push(result);
    } catch (e) {
      lines.push('ERROR: ' + e.message);
    }
  }

  return lines.join('\n');
}

/**
 * フォームトークンシートから指定リードIDの全行を削除する（DRY_RUN / CONFIRM）
 * before/after を生ログで返す
 * @param {string} leadId - 対象リードID（例: 'LDI-00001'）
 * @param {string} mode   - 'DRY_RUN'（デフォルト）または 'CONFIRM'
 * @returns {string}
 */
function clearFormTokensByLeadId(leadId, mode) {
  var isConfirm = String(mode || '').trim().toUpperCase() === 'CONFIRM';
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(FORM_TOKEN_SHEET);
  if (!sh) return 'ERROR: ' + FORM_TOKEN_SHEET + ' シートが存在しません';

  var lines = ['=== clearFormTokensByLeadId [' + leadId + '] [' +
               (isConfirm ? 'CONFIRM' : 'DRY RUN') + '] ===', ''];

  var data   = sh.getDataRange().getValues();
  var h      = data[0];
  var lidIdx = h.indexOf('リードID');
  var tokIdx = h.indexOf('トークン');
  if (lidIdx < 0) return 'ERROR: リードID 列なし';

  // --- before: 全行を表示 ---
  lines.push('[before] フォームトークン全行（ヘッダー除く ' + (data.length - 1) + '行）:');
  for (var i = 1; i < data.length; i++) {
    var rowTok = tokIdx >= 0 ? String(data[i][tokIdx] || '').substring(0, 12) + '...' : '?';
    var rowLid = String(data[i][lidIdx] || '');
    lines.push('  行' + (i + 1) + ': リードID="' + rowLid + '" トークン=' + rowTok);
  }
  lines.push('');

  // --- 対象行を収集 ---
  var toDelete = [];
  for (var j = 1; j < data.length; j++) {
    if (String(data[j][lidIdx] || '').trim() === String(leadId).trim()) {
      toDelete.push(j + 1);
    }
  }
  lines.push('[対象] ' + toDelete.length + '行 (リードID=' + leadId + ')');

  if (isConfirm) {
    for (var d = toDelete.length - 1; d >= 0; d--) {
      sh.deleteRow(toDelete[d]);
    }
    var afterRows = Math.max(0, sh.getLastRow() - 1);
    lines.push('  削除実行 ✓');
    lines.push('');
    lines.push('[after] フォームトークン残行数: ' + afterRows + '行' +
               (afterRows === 0 ? ' ✓ (シートが空)' : ''));
  } else {
    lines.push('  → DRY RUN: 変更なし');
    lines.push('[after] （DRY RUN のため変更なし・現在 ' + (data.length - 1) + '行）');
  }

  return lines.join('\n');
}

// ============================================================
// 電話番号バックフィル（国番号/ナショナル番号 分離書込）
// ============================================================

/**
 * 既存顧客マスタ・配送先マスタの 国番号/電話番号(電話) 列に
 * 事前に確認済みの決定表値をバックフィルする（DRY_RUN / CONFIRM）
 *
 * - 要確認4件（CT-00009 / AD-00008 / AD-00050 / AD-00051）は書かない
 * - 電話列は数字のみ（ハイフン・空白除去済みの値を格納）
 * - 両列とも '@' テキスト書式で書込
 *
 * 事後監査（CONFIRM のみ）:
 *   ① 全書込値が string 型
 *   ② 国番号空欄 = 要確認行のみ
 *   ③ 「国番号 + 電話番号」合成 = 元生値（記号除去後・含む形式行のみ）
 *
 * @param {string} mode - 'DRY_RUN'（省略可・デフォルト）または 'CONFIRM'
 * @returns {string} 実行ログ
 */
function backfillPhoneSplit(mode) {
  var isConfirm = String(mode || '').trim().toUpperCase() === 'CONFIRM';
  var ss = getSpreadsheet();
  var lines = ['=== backfillPhoneSplit [' + (isConfirm ? 'CONFIRM' : 'DRY RUN') + '] ===', ''];

  // ----------------------------------------------------------------
  // 決定表（定数）
  // ----------------------------------------------------------------
  var CUST_TABLE = [
    ['CT-00002','1','9097086506'],   ['CT-00003','44','7743514687'],
    ['CT-00004','44','7887530690'],  ['CT-00005','44','7545134259'],
    ['CT-00006','44','7526015449'],  ['CT-00007','44','7526015449'],
    ['CT-00008','44','7743514687'],  ['CT-00010','33','669422158'],
    ['CT-00011','1','9194494247'],   ['CT-00012','61','423521100'],
    ['CT-00013','31','622980450'],   ['CT-00014','49','17641510454'],
    ['CT-00015','852','60152724'],   ['CT-00016','1','3053214409'],
    ['CT-00017','91','9903706690'],  ['CT-00018','61','415062622'],
    ['CT-00019','34','625689132'],   ['CT-00020','1','7205059447'],
    ['CT-00021','1','2489214082'],   ['CT-00022','1','8019033605'],
    ['CT-00023','1','2019784761'],   ['CT-00024','1','9198895721'],
    ['CT-00025','34','636501848'],   ['CT-00026','41','793131785'],
    ['CT-00027','33','647247726'],   ['CT-00028','1','6099370795'],
    ['CT-00029','65','88115392'],    ['CT-00030','1','6045053378'],
    ['CT-00031','47','95404997'],    ['CT-00032','1','6045053378'],
    ['CT-00033','65','84913315'],    ['CT-00034','60','85038500'],
    ['CT-00035','61','400668878'],   ['CT-00036','34','657734436'],
    ['CT-00037','62','81188017217'], ['CT-00038','1','6076013261'],
    ['CT-00039','1','5179158275'],   ['CT-00040','65','84379903'],
    ['CT-00041','31','611715513'],   ['CT-00042','44','7944652997'],
    ['CT-00043','1','9167534811'],   ['CT-00044','1','3236406233'],
    ['CT-00045','60','126393268'],   ['CT-00046','852','66200324'],
    ['CT-00047','1','7076486224'],   ['CT-00048','46','738950276'],
    ['CT-00049','49','1627688206'],  ['CT-00050','61','424352487'],
    ['CT-00051','376','367830'],     ['CT-00052','1','4089609233']
  ];

  var SHIP_TABLE = [
    ['AD-00001','1','9097086506'],   ['AD-00002','44','7743514687'],
    ['AD-00003','44','7887530690'],  ['AD-00004','44','7545134259'],
    ['AD-00005','44','7526015449'],  ['AD-00006','44','7526015449'],
    ['AD-00007','44','7743514687'],  ['AD-00009','33','669422158'],
    ['AD-00010','1','9194494247'],   ['AD-00011','61','423521100'],
    ['AD-00012','31','622980450'],   ['AD-00013','49','17641510454'],
    ['AD-00014','852','60152724'],   ['AD-00015','1','3053214409'],
    ['AD-00016','852','52221152'],   ['AD-00017','61','415062622'],
    ['AD-00018','34','625689132'],   ['AD-00019','1','7205059447'],
    ['AD-00020','1','2489214082'],   ['AD-00021','1','8019033605'],
    ['AD-00022','1','2019784761'],   ['AD-00023','1','9198895721'],
    ['AD-00024','34','636501848'],   ['AD-00025','41','793131785'],
    ['AD-00026','33','647247726'],   ['AD-00027','1','6099370795'],
    ['AD-00028','65','88115392'],    ['AD-00029','1','6045053378'],
    ['AD-00030','47','95404997'],    ['AD-00031','1','6045053378'],
    ['AD-00032','65','84913315'],    ['AD-00033','60','85038500'],
    ['AD-00034','61','400668878'],   ['AD-00035','34','657734436'],
    ['AD-00036','62','81188017217'], ['AD-00037','1','6076013261'],
    ['AD-00038','1','5179158275'],   ['AD-00039','65','84379903'],
    ['AD-00040','31','611715513'],   ['AD-00041','44','7944652997'],
    ['AD-00042','1','9167534811'],   ['AD-00043','1','3236406233'],
    ['AD-00044','60','126393268'],   ['AD-00045','852','66200324'],
    ['AD-00046','1','7076486224'],   ['AD-00047','46','738950276'],
    ['AD-00048','49','1627688206'],  ['AD-00049','61','424352487']
  ];

  // ----------------------------------------------------------------
  // 元生値の記号除去（'含む'判定・合成チェック用）
  // ----------------------------------------------------------------
  function cleanRaw(raw) {
    var s = String(raw || '').replace(/[\s\-\(\)\.\/]/g, '');
    if (s.charAt(0) === '+') return { isInternational: true, digits: s.slice(1) };
    if (s.slice(0, 2) === '00') return { isInternational: true, digits: s.slice(2) };
    return { isInternational: false, digits: s };
  }

  // ----------------------------------------------------------------
  // 1シート分を処理する内部関数
  // ----------------------------------------------------------------
  function processSheet(shName, idCol, dialCol, phoneCol, table, skipLabel) {
    var sh = ss.getSheetByName(shName);
    if (!sh) { lines.push('[' + shName + '] シートなし'); return []; }

    var data = sh.getDataRange().getValues();
    var h = data[0];
    var idIdx   = h.indexOf(idCol);
    var dialIdx = h.indexOf(dialCol);
    var natIdx  = h.indexOf(phoneCol);
    if (idIdx < 0 || dialIdx < 0 || natIdx < 0) {
      lines.push('[' + shName + '] 列なし (id=' + idIdx + ' dial=' + dialIdx + ' nat=' + natIdx + ')');
      return [];
    }

    // 行番号インデックス構築
    var rowMap = {};
    for (var i = 1; i < data.length; i++) {
      rowMap[String(data[i][idIdx] || '').trim()] = {
        rowNum:  i + 1,
        origDial: String(data[i][dialIdx] || ''),
        origNat:  String(data[i][natIdx]  || '')
      };
    }

    lines.push('[' + shName + '] 対象=' + table.length + '行 スキップ=' + skipLabel);
    var writes = [];  // {rowNum, dialIdx, natIdx, dial, nat, origNat, id}

    table.forEach(function(entry) {
      var id = entry[0], dial = entry[1], nat = entry[2];
      var row = rowMap[id];
      if (!row) {
        lines.push('  ' + id + ': シートに存在しない（スキップ）');
        return;
      }
      lines.push('  ' + id + ': before[国番号="' + row.origDial + '" ' + phoneCol + '="' + row.origNat +
                 '"] → after[国番号="' + dial + '" ' + phoneCol + '="' + nat + '"]');
      writes.push({ rowNum: row.rowNum, dialIdx: dialIdx, natIdx: natIdx,
                    dial: dial, nat: nat, origNat: row.origNat, id: id });
    });
    lines.push('');

    if (isConfirm) {
      SpreadsheetApp.flush();
      writes.forEach(function(w) {
        sh.getRange(w.rowNum, w.dialIdx + 1).setNumberFormat('@').setValue(w.dial);
        sh.getRange(w.rowNum, w.natIdx  + 1).setNumberFormat('@').setValue(w.nat);
      });
      SpreadsheetApp.flush();
      lines.push('  書込完了 ✓ (' + writes.length + '行)', '');
    }

    return writes;
  }

  var custWrites = processSheet(
    CONFIG.SHEETS.CRM_CUSTOMERS, '顧客ID', '国番号', '電話番号', CUST_TABLE, 'CT-00001/CT-00009'
  );
  var shipWrites = processSheet(
    CONFIG.SHEETS.CRM_SHIPPING, '配送先ID', '国番号', '電話', SHIP_TABLE, 'AD-00008/AD-00050/AD-00051'
  );

  if (!isConfirm) {
    lines.push('→ DRY RUN 完了。内容を確認後 backfillPhoneSplit("CONFIRM") を実行してください。');
    return lines.join('\n');
  }

  // ----------------------------------------------------------------
  // 事後監査（CONFIRM 後）
  // ----------------------------------------------------------------
  lines.push('=== 事後監査 ===', '');
  var auditPass = true;

  function auditSheet(shName, idCol, dialCol, phoneCol, table, skipIds, writes) {
    var sh = ss.getSheetByName(shName);
    if (!sh) { lines.push('[' + shName + '] シートなし'); auditPass = false; return; }
    var data = sh.getDataRange().getValues();
    var h = data[0];
    var idIdx   = h.indexOf(idCol);
    var dialIdx = h.indexOf(dialCol);
    var natIdx  = h.indexOf(phoneCol);

    // build id→row map
    var rowMap = {};
    for (var i = 1; i < data.length; i++) {
      rowMap[String(data[i][idIdx] || '').trim()] = data[i];
    }

    var typeErrors = [], blankErrors = [], synthErrors = [];

    // ① 書込行: string型 ＆ 合成チェック
    writes.forEach(function(w) {
      var row = rowMap[w.id];
      if (!row) { typeErrors.push(w.id + ': 行なし'); return; }
      var rdial = row[dialIdx];
      var rnat  = row[natIdx];

      // string型チェック
      if (typeof rdial !== 'string') typeErrors.push(w.id + ' 国番号 type=' + typeof rdial);
      if (typeof rnat  !== 'string') typeErrors.push(w.id + ' ' + phoneCol + ' type=' + typeof rnat);

      // ③ 合成チェック（含む形式行のみ）
      var cr = cleanRaw(w.origNat);
      if (cr.isInternational) {
        var synth = String(rdial || '') + String(rnat || '');
        if (synth !== cr.digits) {
          synthErrors.push(w.id + ': 合成=' + synth + ' 期待=' + cr.digits + ' (元値="' + w.origNat + '")');
        }
      }
    });

    // ② 国番号が空の行 → 要確認行のみであること
    for (var ri = 1; ri < data.length; ri++) {
      var rid  = String(data[ri][idIdx]   || '').trim();
      var rdial2 = String(data[ri][dialIdx] || '').trim();
      if (rdial2 === '' && skipIds.indexOf(rid) < 0) {
        // 決定表にないID（CT-00001 等）は空欄で正常
        var inTable = table.some(function(e) { return e[0] === rid; });
        if (inTable) blankErrors.push(rid + ': 決定表あり・国番号が空');
      }
    }

    var ok1 = typeErrors.length === 0;
    var ok2 = blankErrors.length === 0;
    var ok3 = synthErrors.length === 0;
    lines.push('[' + shName + ']');
    lines.push('  ①string型: ' + (ok1 ? '✓ 全値OK' : '✗ ' + typeErrors.join(' / ')));
    lines.push('  ②空欄=要確認のみ: ' + (ok2 ? '✓' : '✗ ' + blankErrors.join(' / ')));
    lines.push('  ③合成一致(含む行): ' + (ok3 ? '✓' : '✗ ' + synthErrors.join(' / ')));
    lines.push('');
    if (!ok1 || !ok2 || !ok3) auditPass = false;
  }

  auditSheet(CONFIG.SHEETS.CRM_CUSTOMERS, '顧客ID', '国番号', '電話番号',
             CUST_TABLE, ['CT-00001','CT-00009'], custWrites);
  auditSheet(CONFIG.SHEETS.CRM_SHIPPING, '配送先ID', '国番号', '電話',
             SHIP_TABLE, ['AD-00008','AD-00050','AD-00051'], shipWrites);

  lines.push('監査結果: ' + (auditPass ? '✓ 全チェック PASS' : '✗ 要確認あり'));
  return lines.join('\n');
}
