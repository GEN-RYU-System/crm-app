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
  // 元生値の数字のみ抽出（+/記号/空白をすべて除去）
  // ----------------------------------------------------------------
  function digitsOnly(raw) {
    return String(raw || '').replace(/\D/g, '');
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

    // ① string型チェック ＋ ③ 不変条件チェック（全書込行）
    writes.forEach(function(w) {
      var row = rowMap[w.id];
      if (!row) { typeErrors.push(w.id + ': 行なし'); return; }
      var rdial = row[dialIdx];
      var rnat  = row[natIdx];

      // ① string型
      if (typeof rdial !== 'string') typeErrors.push(w.id + ' 国番号 type=' + typeof rdial);
      if (typeof rnat  !== 'string') typeErrors.push(w.id + ' ' + phoneCol + ' type=' + typeof rnat);

      // ③ 不変条件: digits(元生値) === dial+nat  OR  digits(元生値) === nat
      //    どちらも不成立の行はエラー
      var digits = digitsOnly(w.origNat);
      var synthFull = String(rdial || '') + String(rnat || '');
      var synthNat  = String(rnat  || '');
      if (digits !== '' && synthFull !== digits && synthNat !== digits) {
        synthErrors.push(w.id + ': dial="' + rdial + '" nat="' + rnat +
                         '" digits="' + digits + '" (元値="' + w.origNat + '")');
      }
    });

    // ② 国番号が空の行 → 要確認行（skipIds）または決定表外IDのみであること
    for (var ri = 1; ri < data.length; ri++) {
      var rid    = String(data[ri][idIdx]   || '').trim();
      var rdial2 = String(data[ri][dialIdx] || '').trim();
      if (rdial2 === '' && skipIds.indexOf(rid) < 0) {
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
    lines.push('  ③不変条件(dial+nat|nat = digits): ' +
               (ok3 ? '✓ 全行OK' : '✗\n    ' + synthErrors.join('\n    ')));
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

/**
 * 配送先マスタ AD-00050/AD-00051 の列ズレを是正する（DRY_RUN / CONFIRM）
 *
 * AD-00050 (CT-00051 ARSEL SLU, Andorra) : データは正常。電話・国番号・Zip を '@'書式で保証。
 * AD-00051 (CT-00052 KantoKillz, US)    : 列ズレ是正。Address3→空/City→Santa Clarita/
 *                                          State→CA/Zip→91387/国→United States に修正。
 *
 * @param {string} mode - 'DRY_RUN'（省略可・デフォルト）または 'CONFIRM'
 * @returns {string} 実行ログ
 */
function fixShiftedShippingRows(mode) {
  var isConfirm = String(mode || '').trim().toUpperCase() === 'CONFIRM';
  var ss = getSpreadsheet();
  var lines = ['=== fixShiftedShippingRows [' + (isConfirm ? 'CONFIRM' : 'DRY RUN') + '] ===', ''];

  // ----------------------------------------------------------------
  // 是正表（定数）
  // 16列: 配送先ID / 顧客ID / 宛名 / Address 1 / Address 2 / Address 3 /
  //       City / State / Zip / 国 / 電話 / 国番号 / D Email / D Tax ID / 既定 / 有効
  // textCols: '@' テキスト書式を適用する列番号（1始まり）
  // ----------------------------------------------------------------
  var CORRECTION_TABLE = [
    {
      id: 'AD-00050',
      values: [
        'AD-00050', 'CT-00051', 'ARSEL SLU',
        'Carrer Hort de Godi', 'Edifici Tintorell', 'Ground Floor, 2nd Door',
        'Encamp', 'Andorra', 'AD200', 'Andorra',
        '367830', '376', 'arselcontacto@gmail.com', 'L-718880-G',
        true, true
      ],
      textCols: [9, 11, 12]  // Zip, 電話, 国番号
    },
    {
      id: 'AD-00051',
      values: [
        'AD-00051', 'CT-00052', 'Vishal Rajasekhar',
        '27124 Silver Oak Lane', '1222', '',
        'Santa Clarita', 'CA', '91387', 'United States',
        '4082024995', '1', 'kantokillz@gmail.com', '332796234',
        true, true
      ],
      textCols: [5, 9, 11, 12, 14]  // Address 2, Zip, 電話, 国番号, D Tax ID
    }
  ];

  var sh = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  if (!sh) { return 'エラー: 配送先マスタ シートなし'; }

  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idIdx = headers.indexOf('配送先ID');
  if (idIdx < 0) { return 'エラー: 配送先ID 列なし (headers: ' + headers.slice(0, 5).join('|') + ')'; }

  CORRECTION_TABLE.forEach(function(entry) {
    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() === entry.id) { rowIdx = i; break; }
    }
    if (rowIdx < 0) {
      lines.push('[' + entry.id + '] 行が見つかりません');
      return;
    }

    var before = data[rowIdx];
    lines.push('--- ' + entry.id + ' ---');
    lines.push('  BEFORE:');
    headers.forEach(function(h, ci) {
      lines.push('    col' + (ci + 1) + ':' + h + ' = ' + JSON.stringify(before[ci]) + ' (' + typeof before[ci] + ')');
    });
    lines.push('  AFTER:');
    entry.values.forEach(function(v, ci) {
      lines.push('    col' + (ci + 1) + ':' + headers[ci] + ' = ' + JSON.stringify(v) + ' (' + typeof v + ')');
    });
    lines.push('');

    if (isConfirm) {
      var formats = new Array(entry.values.length).fill('');
      entry.textCols.forEach(function(col1) { formats[col1 - 1] = '@'; });
      var range = sh.getRange(rowIdx + 1, 1, 1, entry.values.length);
      range.setNumberFormats([formats]);
      range.setValues([entry.values]);
      lines.push('  [' + entry.id + '] 書込済み');
    }
  });

  if (!isConfirm) {
    lines.push('--- DRY RUN 完了。CONFIRM で実行してください ---');
    return lines.join('\n');
  }

  SpreadsheetApp.flush();
  lines.push('');
  lines.push('=== 監査 ===');

  var data2 = sh.getDataRange().getValues();
  var h2 = data2[0];

  // ① AD-00050: 電話/国番号/D Email の値と型確認
  var row50 = null;
  for (var i = 1; i < data2.length; i++) {
    if (String(data2[i][idIdx]).trim() === 'AD-00050') { row50 = data2[i]; break; }
  }
  if (row50) {
    var p50 = row50[h2.indexOf('電話')];
    var d50 = row50[h2.indexOf('国番号')];
    var e50 = row50[h2.indexOf('D Email')];
    var ok50 = (p50 === '367830' && typeof p50 === 'string') &&
               (d50 === '376'    && typeof d50 === 'string') &&
               (e50 === 'arselcontacto@gmail.com' && typeof e50 === 'string');
    lines.push('① AD-00050: 電話="' + p50 + '"(' + typeof p50 + ') 国番号="' + d50 + '"(' + typeof d50 + ') Email="' + e50 + '"(' + typeof e50 + ') → ' + (ok50 ? '✓' : '✗'));
  } else {
    lines.push('① AD-00050: 行なし ✗');
  }

  // ② AD-00051: City/State/Zip/国・Address3空・電話/国番号
  var row51 = null;
  for (var i = 1; i < data2.length; i++) {
    if (String(data2[i][idIdx]).trim() === 'AD-00051') { row51 = data2[i]; break; }
  }
  if (row51) {
    var city51  = row51[h2.indexOf('City')];
    var state51 = row51[h2.indexOf('State')];
    var zip51   = row51[h2.indexOf('Zip')];
    var koku51  = row51[h2.indexOf('国')];
    var addr3   = row51[h2.indexOf('Address 3')];
    var p51     = row51[h2.indexOf('電話')];
    var d51     = row51[h2.indexOf('国番号')];
    var ok51 = (city51 === 'Santa Clarita') &&
               (state51 === 'CA') &&
               (typeof zip51 === 'string' && zip51 === '91387') &&
               (koku51 === 'United States') &&
               (String(addr3 || '') === '') &&
               (typeof p51 === 'string' && p51 === '4082024995') &&
               (typeof d51 === 'string' && d51 === '1');
    lines.push('② AD-00051: City="' + city51 + '" State="' + state51 + '" Zip="' + zip51 + '"(' + typeof zip51 + ') 国="' + koku51 + '" Addr3="' + String(addr3 || '') + '" 電話="' + p51 + '"(' + typeof p51 + ') 国番号="' + d51 + '"(' + typeof d51 + ') → ' + (ok51 ? '✓' : '✗'));
  } else {
    lines.push('② AD-00051: 行なし ✗');
  }

  // ③ PY-00050/PY-00051 と住所本体（Address1/2・City・Zip・国）が一致すること
  var shPay = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
  if (shPay) {
    var dataPay = shPay.getDataRange().getValues();
    var hPay = dataPay[0];
    var payIdIdx = hPay.indexOf('支払先ID');
    var checkCols = ['Address 1', 'Address 2', 'City', 'Zip', '国'];
    var pairs = [['AD-00050', 'PY-00050'], ['AD-00051', 'PY-00051']];
    pairs.forEach(function(pair) {
      var adId = pair[0], pyId = pair[1];
      var adRow = null;
      for (var i = 1; i < data2.length; i++) {
        if (String(data2[i][idIdx]).trim() === adId) { adRow = data2[i]; break; }
      }
      var pyRow = null;
      for (var i = 1; i < dataPay.length; i++) {
        if (String(dataPay[i][payIdIdx]).trim() === pyId) { pyRow = dataPay[i]; break; }
      }
      if (!adRow || !pyRow) {
        lines.push('③ ' + adId + '/' + pyId + ': 行なし ✗');
        return;
      }
      var ok3 = true;
      var details = [];
      checkCols.forEach(function(col) {
        var av = String(adRow[h2.indexOf(col)] || '');
        var pv = String(pyRow[hPay.indexOf(col)] || '');
        var m = (av === pv);
        details.push(col + ':"' + av + '"vs"' + pv + '"' + (m ? '✓' : '✗'));
        if (!m) ok3 = false;
      });
      lines.push('③ ' + adId + '/' + pyId + ': ' + details.join(' | ') + ' → ' + (ok3 ? '✓' : '✗'));
    });
  } else {
    lines.push('③ 支払先マスタ シートなし ✗');
  }

  lines.push('');
  lines.push('（④ verifyLedgerCountries は別途 clasp run verifyLedgerCountries で確認してください）');
  return lines.join('\n');
}

/**
 * 「売上データ」タブの構造と実態を読み取り専用で調査する
 * （書き込み・列追加は一切行わない）
 *
 * 調査内容:
 *   1. ヘッダー行の全列（何行目かも含む）
 *   2. 総行数 / 61行目以降の実データ行数
 *   3. 61・62・63行目の全列フルダンプ（値＋型）
 *   4. 61行目以降の主要列の充足率
 *   5. 顧客名ユニーク一覧と顧客マスタ51件との突合
 *
 * @returns {string} 調査ログ
 */
function dumpSalesDataStructure() {
  var lines = ['=== dumpSalesDataStructure ===', ''];

  // ----------------------------------------------------------------
  // シート取得: CRM本体を優先、なければ ERP スプレッドシートを試行
  // ----------------------------------------------------------------
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  var sourceLabel = 'CRM: ' + CONFIG.SHEETS.SALES_DATA;
  if (!sh) {
    try {
      var erpSs = SpreadsheetApp.openById(CONFIG.ERP.SPREADSHEET_ID);
      sh = erpSs.getSheetByName(CONFIG.ERP.SHEETS.SALES_DATA);
      sourceLabel = 'ERP: ' + CONFIG.ERP.SHEETS.SALES_DATA;
    } catch (e) { /* fall through */ }
  }
  if (!sh) {
    return 'エラー: 売上データ タブが CRM / ERP どちらにも見つかりません';
  }
  lines.push('【取得元】' + sourceLabel);
  lines.push('');

  // ----------------------------------------------------------------
  // 全データ取得
  // ----------------------------------------------------------------
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  lines.push('【基本情報】 lastRow=' + lastRow + '  lastCol=' + lastCol);
  lines.push('');

  if (lastRow === 0 || lastCol === 0) {
    return lines.join('\n') + '\nシートが空です';
  }

  // ---- 全データ取得 ----
  var allData = sh.getDataRange().getValues();

  // ---- 0. rows 55-62 raw dump（ヘッダー境界確認用） ----
  lines.push('--- 0. row55〜62 生値（ヘッダー境界確認用・非空セルのみ） ---');
  for (var rr = 54; rr <= 61 && rr < allData.length; rr++) {
    var nonEmptyCells = [];
    allData[rr].forEach(function(v, ci) {
      if (String(v).trim() !== '' && v !== false) {
        nonEmptyCells.push('col' + (ci + 1) + '=' + JSON.stringify(v));
      }
    });
    lines.push('  row' + (rr + 1) + ': ' + nonEmptyCells.join(' | '));
  }
  lines.push('');

  // ---- 1. ヘッダー行の特定:
  //   DATA_START_ROW(61)より前の行で、「短い文字列セルの数」が最大の行をヘッダーとみなす
  //   （タイトル行・集計行は数値や長文URLを含むため低スコア） ----
  var DATA_START_ROW = 61; // 1始まり
  var dataStartIdx = DATA_START_ROW - 1; // 0始まり

  var headerRowIdx = -1; // 0始まり
  var headers = [];
  var bestScore = 0;
  var scanLimit = Math.min(allData.length, dataStartIdx); // row60まで
  for (var r = 0; r < scanLimit; r++) {
    var score = 0;
    allData[r].forEach(function(v) {
      var s = String(v).trim();
      // 非空・50文字未満・URLでない文字列をカウント
      if (typeof v === 'string' && s !== '' && s.length < 50 && s.indexOf('http') < 0) score++;
    });
    if (score > bestScore) { bestScore = score; headerRowIdx = r; headers = allData[r]; }
  }
  if (headerRowIdx < 0) {
    lines.push('ヘッダー行が特定できませんでした（row1〜60に候補なし）');
    return lines.join('\n');
  }
  lines.push('--- 1. ヘッダー行 (シート行番号: ' + (headerRowIdx + 1) + ', score=' + bestScore + ') ---');
  headers.forEach(function(h, ci) {
    lines.push('  col' + (ci + 1) + ': ' + (String(h).trim() || '(空)'));
  });
  lines.push('');

  // ---- 2. 総行数 / 61行目以降の実データ行数 ----
  var totalRows = allData.length;
  var dataRows = (totalRows >= dataStartIdx) ? (totalRows - dataStartIdx) : 0;
  lines.push('--- 2. 行数 ---');
  lines.push('  総行数 (allData): ' + totalRows);
  lines.push('  61行目以降の行数: ' + dataRows);
  lines.push('');

  // ---- 3. 61・62・63行目のフルダンプ ----
  lines.push('--- 3. 61・62・63行目フルダンプ ---');
  [61, 62, 63].forEach(function(rowNum) {
    var idx = rowNum - 1;
    if (idx >= totalRows) { lines.push('  row' + rowNum + ': データなし'); return; }
    lines.push('  row' + rowNum + ':');
    headers.forEach(function(h, ci) {
      var v = allData[idx][ci];
      lines.push('    col' + (ci + 1) + ':' + (String(h).trim() || '(空)') + ' = ' + JSON.stringify(v) + ' (' + typeof v + ')');
    });
  });
  lines.push('');

  // ---- 4. 61行目以降の主要列充足率 ----
  var checkColNames = [
    '顧客名', '取引先名', 'リードID', '請求書番号', '請求書発行日',
    '支払確認日', '合計', '小計', '通貨', '発送日', '運送状番号', '商品名', '数量'
  ];
  // ヘッダー列インデックスを解決（完全一致、なければ部分一致）
  function resolveColIdx(name) {
    var exact = headers.indexOf(name);
    if (exact >= 0) return exact;
    for (var ci = 0; ci < headers.length; ci++) {
      if (String(headers[ci]).indexOf(name) >= 0) return ci;
    }
    return -1;
  }

  lines.push('--- 4. 主要列充足率 (61行目以降, 全' + dataRows + '件) ---');
  var dataSlice = allData.slice(dataStartIdx);
  // 顧客名と取引先名を「どちらかあれば1件」でカウント
  var custNameIdx  = resolveColIdx('顧客名');
  var partnerIdx   = resolveColIdx('取引先名');
  var custOrPartnerCount = dataSlice.filter(function(row) {
    var a = (custNameIdx >= 0) ? String(row[custNameIdx] || '').trim() : '';
    var b = (partnerIdx  >= 0) ? String(row[partnerIdx]  || '').trim() : '';
    return a !== '' || b !== '';
  }).length;
  lines.push('  顧客名or取引先名 : ' + custOrPartnerCount + '/' + dataRows +
             ' (col顧客名=' + (custNameIdx + 1) + ' col取引先名=' + (partnerIdx + 1) + ')');

  var singleChecks = ['リードID', '請求書番号', '請求書発行日', '支払確認日',
                      '合計', '小計', '通貨', '発送日', '運送状番号', '商品名', '数量'];
  singleChecks.forEach(function(colName) {
    var ci = resolveColIdx(colName);
    if (ci < 0) {
      lines.push('  ' + colName + ': 列なし (未定義)');
      return;
    }
    var count = dataSlice.filter(function(row) {
      return String(row[ci] || '').trim() !== '';
    }).length;
    lines.push('  ' + colName + ' (col' + (ci + 1) + '): ' + count + '/' + dataRows);
  });
  lines.push('');

  // ---- 5. 顧客名ユニーク一覧と顧客マスタ突合 ----
  lines.push('--- 5. 顧客名ユニーク一覧と顧客マスタ突合 ---');

  // 売上データから顧客名収集（顧客名 or 取引先名）
  var salesNamesMap = {};
  dataSlice.forEach(function(row) {
    var a = (custNameIdx >= 0) ? String(row[custNameIdx] || '').trim() : '';
    var b = (partnerIdx  >= 0) ? String(row[partnerIdx]  || '').trim() : '';
    var name = a !== '' ? a : b;
    if (name !== '') salesNamesMap[name] = (salesNamesMap[name] || 0) + 1;
  });
  var salesNames = Object.keys(salesNamesMap).sort();
  lines.push('  売上データ ユニーク顧客名 ' + salesNames.length + ' 件:');
  salesNames.forEach(function(n) {
    lines.push('    "' + n + '" (' + salesNamesMap[n] + '件)');
  });
  lines.push('');

  // 顧客マスタ取得
  var custSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  if (!custSheet) {
    lines.push('  顧客マスタ取得失敗: シートなし');
    return lines.join('\n');
  }
  var custData = custSheet.getDataRange().getValues();
  var custH = custData[0];
  var custIdIdx   = custH.indexOf('顧客ID');
  var custNameColIdx = custH.indexOf('顧客名');
  if (custNameColIdx < 0) custNameColIdx = custH.indexOf('会社名');
  if (custNameColIdx < 0) custNameColIdx = custH.indexOf('取引先名');
  lines.push('  顧客マスタ: 顧客名列=col' + (custNameColIdx + 1) + ':' + custH[custNameColIdx]);

  var custMap = {}; // 顧客名 → 顧客ID
  for (var i = 1; i < custData.length; i++) {
    var cName = String(custData[i][custNameColIdx] || '').trim();
    var cId   = String(custData[i][custIdIdx]      || '').trim();
    if (cName) custMap[cName] = cId;
  }
  lines.push('  顧客マスタ件数: ' + Object.keys(custMap).length + ' 件');
  lines.push('');

  var matched = [];
  var unmatched = [];
  salesNames.forEach(function(n) {
    if (custMap[n] !== undefined) {
      matched.push({ name: n, id: custMap[n], count: salesNamesMap[n] });
    } else {
      unmatched.push(n);
    }
  });

  lines.push('  完全一致: ' + matched.length + ' 件');
  matched.forEach(function(m) {
    lines.push('    ✓ ' + m.id + ' "' + m.name + '" (' + m.count + '件)');
  });
  lines.push('');
  lines.push('  不一致（未マッチ）: ' + unmatched.length + ' 件');
  unmatched.forEach(function(n) {
    lines.push('    ✗ "' + n + '" (' + salesNamesMap[n] + '件)');
  });
  lines.push('');

  return lines.join('\n');
}

/**
 * 売上データ追加調査（読み取り専用）
 *   1. row1〜4 の col1〜25 生値でヘッダー行を目視確定
 *   2. 請求書番号(col12) のユニーク件数・複数行跨り事例
 *   3. 61〜80行の金額列サンプル + 合計col14入り全件の内訳
 */
function dumpSalesDataDetails() {
  var lines = ['=== dumpSalesDataDetails ===', ''];

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  if (!sh) { return 'エラー: 売上データ タブなし'; }

  var allData = sh.getDataRange().getValues();
  var totalRows = allData.length;

  // ヘッダー（前回調査でrow3=0-indexed:2 と確定）
  var HEADER_IDX = 2;  // 0-indexed
  var DATA_START = 60; // 0-indexed（row61〜）
  var headers = allData[HEADER_IDX];

  // 列インデックス（0-indexed）
  var C_INVNO = 11;  // col12 請求書番号
  var C_CUST  = 5;   // col6  取引先名
  var C_ITEM  = 9;   // col10 請求書内容
  var C_QTY   = 10;  // col11 数量
  var C_PRICE = 14;  // col15 単価
  var C_SUB   = 15;  // col16 小計
  var C_TOTAL = 13;  // col14 合計
  var C_SHIP  = 17;  // col18 送料
  var C_CURR  = 19;  // col20 通貨

  // ================================================================
  // 1. row1〜4 の col1〜25 生値
  // ================================================================
  lines.push('--- 1. row1〜4 の col1〜col25 生値 ---');
  for (var r = 0; r <= 3 && r < totalRows; r++) {
    lines.push('  row' + (r + 1) + ':');
    for (var c = 0; c < 25 && c < allData[r].length; c++) {
      var v = allData[r][c];
      var display = (v instanceof Date) ? v.toISOString() : JSON.stringify(v);
      lines.push('    col' + (c + 1) + ' = ' + display + ' (' + typeof v + ')');
    }
  }
  lines.push('');

  // ================================================================
  // 2. 請求書番号(col12) ユニーク件数・複数行跨り
  // ================================================================
  lines.push('--- 2. 請求書番号(col12) ユニーク件数・複数行跨り ---');
  var invMap = {};
  for (var i = DATA_START; i < totalRows; i++) {
    var row = allData[i];
    var inv = String(row[C_INVNO] || '').trim();
    if (inv === '') continue;
    if (!invMap[inv]) invMap[inv] = [];
    invMap[inv].push({
      rowNum: i + 1,
      cust:  String(row[C_CUST]  || '').trim(),
      item:  String(row[C_ITEM]  || '').trim(),
      qty:   row[C_QTY],
      price: row[C_PRICE]
    });
  }

  var allInvNos  = Object.keys(invMap);
  var singleRows = allInvNos.filter(function(k) { return invMap[k].length === 1; });
  var multiRows  = allInvNos.filter(function(k) { return invMap[k].length  >  1; });
  multiRows.sort(function(a, b) { return invMap[b].length - invMap[a].length; });

  lines.push('  ユニーク請求書番号: ' + allInvNos.length + ' 件');
  lines.push('  1行のみ: ' + singleRows.length + ' 件');
  lines.push('  2行以上に跨る: ' + multiRows.length + ' 件');
  lines.push('');
  lines.push('  代表例 3組（行数が多い順）:');
  multiRows.slice(0, 3).forEach(function(inv) {
    var entries = invMap[inv];
    lines.push('  ■ 請求書番号: "' + inv + '" (' + entries.length + '行)');
    entries.forEach(function(e) {
      lines.push('    row' + e.rowNum +
                 ' | 取引先名: "' + e.cust  + '"' +
                 ' | 内容: "' + e.item.slice(0, 50) + '"' +
                 ' | 数量: ' + JSON.stringify(e.qty) +
                 ' | 単価: ' + JSON.stringify(e.price));
    });
  });
  lines.push('');

  // ================================================================
  // 3. 61〜80行 金額列サンプル + col14入り全件
  // ================================================================
  var hdr = '  row | 取引先名(col6 先20字)         | 数量(11) |   単価(15) |  小計(16) |   合計(14) |   送料(18) | 通貨(20) |  数量×単価';
  var sep = '  ' + '-'.repeat(120);

  lines.push('--- 3-A. row61〜80 金額列サンプル20行 ---');
  lines.push(hdr);
  lines.push(sep);
  for (var i = DATA_START; i < Math.min(DATA_START + 20, totalRows); i++) {
    var row   = allData[i];
    var qty   = row[C_QTY];
    var price = row[C_PRICE];
    var calc  = (typeof qty === 'number' && typeof price === 'number') ? String(qty * price) : '';
    lines.push('  row' + String(i + 1).padStart(3) +
               ' | ' + String(row[C_CUST] || '').slice(0, 20).padEnd(20) +
               ' | ' + String(qty   !== '' ? qty   : '').padStart(8) +
               ' | ' + String(price !== '' ? price : '').padStart(10) +
               ' | ' + String(row[C_SUB]   || '').padStart(9) +
               ' | ' + String(row[C_TOTAL] || '').padStart(10) +
               ' | ' + String(row[C_SHIP]  || '').padStart(10) +
               ' | ' + String(row[C_CURR]  || '').padStart(8) +
               ' | ' + calc);
  }
  lines.push('');

  lines.push('--- 3-B. col14(合計)が入っている行 全件（61行目以降） ---');
  lines.push(hdr);
  lines.push(sep);
  var totalCount = 0;
  for (var i = DATA_START; i < totalRows; i++) {
    var row = allData[i];
    var tot = row[C_TOTAL];
    if (String(tot || '').trim() === '' || tot === 0) continue;
    totalCount++;
    var qty   = row[C_QTY];
    var price = row[C_PRICE];
    var calc  = (typeof qty === 'number' && typeof price === 'number') ? String(qty * price) : '';
    lines.push('  row' + String(i + 1).padStart(3) +
               ' | ' + String(row[C_CUST] || '').slice(0, 20).padEnd(20) +
               ' | ' + String(qty   !== '' ? qty   : '').padStart(8) +
               ' | ' + String(price !== '' ? price : '').padStart(10) +
               ' | ' + String(row[C_SUB]   || '').padStart(9) +
               ' | ' + String(tot          || '').padStart(10) +
               ' | ' + String(row[C_SHIP]  || '').padStart(10) +
               ' | ' + String(row[C_CURR]  || '').padStart(8) +
               ' | ' + calc);
  }
  lines.push('  合計: ' + totalCount + '件');
  lines.push('');

  return lines.join('\n');
}
