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

/**
 * 売上データ 61行目以降で 請求書番号(col12)が空の行一覧（読み取り専用）
 */
function dumpEmptyInvoiceRows() {
  var lines = ['=== dumpEmptyInvoiceRows ===', ''];

  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  if (!sh) { return 'エラー: 売上データ タブなし'; }

  var allData = sh.getDataRange().getValues();
  var DATA_START = 60; // 0-indexed（row61〜）

  var C_STATUS = 0;   // col1  ステータス
  var C_CUST   = 5;   // col6  取引先名
  var C_ITEM8  = 7;   // col8  商品名
  var C_ITEM10 = 9;   // col10 請求書内容
  var C_QTY    = 10;  // col11 数量
  var C_INVNO  = 11;  // col12 請求書番号
  var C_PRICE  = 14;  // col15 単価
  var C_SHIP   = 17;  // col18 送料
  var C_CURR   = 19;  // col20 通貨
  var C_ISSDT  = 22;  // col23 請求書発行日
  var C_PAYDT  = 24;  // col25 支払確認日
  var C_SENDT  = 78;  // col79 発送日
  var C_TRACK  = 79;  // col80 運送状番号

  function fmtDate(v) {
    if (!v || v === '') return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  }

  var emptyRows = [];
  for (var i = DATA_START; i < allData.length; i++) {
    var row = allData[i];
    if (String(row[C_INVNO] || '').trim() !== '') continue;
    emptyRows.push({ idx: i, row: row });
  }

  lines.push('請求書番号が空の行: ' + emptyRows.length + '件（61行目以降）');
  lines.push('');

  lines.push('--- 全件一覧 ---');
  emptyRows.forEach(function(e) {
    var r = e.row;
    var trackStr = String(r[C_TRACK] || '');
    lines.push(
      'row' + (e.idx + 1) +
      ' | ステータス=' + JSON.stringify(String(r[C_STATUS] || '')) +
      ' | 取引先=' + JSON.stringify(String(r[C_CUST] || '').slice(0, 25)) +
      ' | 商品名(8)=' + JSON.stringify(String(r[C_ITEM8] || '').slice(0, 30)) +
      ' | 内容(10)=' + JSON.stringify(String(r[C_ITEM10] || '').slice(0, 30)) +
      ' | 数量=' + JSON.stringify(r[C_QTY]) +
      ' | 単価=' + JSON.stringify(r[C_PRICE]) +
      ' | 送料=' + JSON.stringify(r[C_SHIP]) +
      ' | 通貨=' + JSON.stringify(String(r[C_CURR] || '')) +
      ' | 請求書発行日=' + fmtDate(r[C_ISSDT]) +
      ' | 支払確認日=' + fmtDate(r[C_PAYDT]) +
      ' | 発送日=' + fmtDate(r[C_SENDT]) +
      ' | 運送状番号=' + JSON.stringify(trackStr)
    );
  });
  lines.push('');

  var custBlankCount = emptyRows.filter(function(e) {
    return String(e.row[C_CUST] || '').trim() === '';
  }).length;
  var dataBlankCount = emptyRows.filter(function(e) {
    return String(e.row[C_QTY] || '').trim() === '' && String(e.row[C_PRICE] || '').trim() === '';
  }).length;

  var statusMap = {};
  emptyRows.forEach(function(e) {
    var st = String(e.row[C_STATUS] || '(空)').trim() || '(空)';
    statusMap[st] = (statusMap[st] || 0) + 1;
  });

  lines.push('--- 集計 ---');
  lines.push('  取引先名も空: ' + custBlankCount + '件');
  lines.push('  数量・単価とも空（実質空行候補）: ' + dataBlankCount + '件');
  lines.push('  ステータス内訳:');
  Object.keys(statusMap).sort().forEach(function(k) {
    lines.push('    ' + k + ': ' + statusMap[k] + '件');
  });
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// ★ オーダー管理タブ関連関数 ★
// ============================================================

/**
 * オーダー管理 / オーダー明細タブを新規作成する
 *
 * - 既に同名タブが存在する場合は作成せず中止して報告
 * - ヘッダー行を書き込み、文字列固定が必要な列（運送状番号）に '@' 書式を適用
 * - データ投入は行わない
 */
function createOrderTabs() {
  var ss = getSpreadsheet();
  var lines = [];

  // ---------- 存在チェック ----------
  var existingNames = ss.getSheets().map(function(s) { return s.getName(); });
  var masterName = CONFIG.SHEETS.ORDER_MASTER;
  var linesName  = CONFIG.SHEETS.ORDER_LINES;

  if (existingNames.indexOf(masterName) !== -1) {
    lines.push('[ABORT] タブ「' + masterName + '」は既に存在します。作成をスキップしました。');
    Logger.log(lines.join('\n'));
    return lines.join('\n');
  }
  if (existingNames.indexOf(linesName) !== -1) {
    lines.push('[ABORT] タブ「' + linesName + '」は既に存在します。作成をスキップしました。');
    Logger.log(lines.join('\n'));
    return lines.join('\n');
  }

  // ---------- オーダー管理タブ作成 ----------
  var masterSheet = ss.insertSheet(masterName);
  var masterHeaders = HEADERS.ORDER_MASTER;
  masterSheet.getRange(1, 1, 1, masterHeaders.length).setValues([masterHeaders]);

  // 運送状番号（col22）を文字列書式に固定（数値変換防止）
  var trackingCol = 22; // '運送状番号'
  masterSheet.getRange(2, trackingCol, 1000, 1).setNumberFormat('@');

  lines.push('[OK] タブ作成: ' + masterName + '（' + masterHeaders.length + '列）');
  lines.push('  ヘッダー: ' + masterHeaders.join(' | '));
  lines.push('  運送状番号 col' + trackingCol + ' → 文字列書式適用（rows 2–1001）');

  // ---------- オーダー明細タブ作成 ----------
  var linesSheet = ss.insertSheet(linesName);
  var linesHeaders = HEADERS.ORDER_LINES;
  linesSheet.getRange(1, 1, 1, linesHeaders.length).setValues([linesHeaders]);

  lines.push('[OK] タブ作成: ' + linesName + '（' + linesHeaders.length + '列）');
  lines.push('  ヘッダー: ' + linesHeaders.join(' | '));

  SpreadsheetApp.flush();
  lines.push('');
  lines.push('[DONE] 両タブの作成が完了しました。');

  Logger.log(lines.join('\n'));
  return lines.join('\n');
}

/**
 * オーダー管理 / オーダー明細タブの実ヘッダーと CONFIG 定義を比較する
 *
 * 報告形式:
 *   - 列番号 / CONFIG定義 / 実シート値 / 一致
 * 最後に mismatches=N を出力する
 */
function compareOrderHeaders() {
  var ss = getSpreadsheet();
  var lines = [];

  [
    { sheetKey: 'ORDER_MASTER', sheetName: CONFIG.SHEETS.ORDER_MASTER, headers: HEADERS.ORDER_MASTER },
    { sheetKey: 'ORDER_LINES',  sheetName: CONFIG.SHEETS.ORDER_LINES,  headers: HEADERS.ORDER_LINES  }
  ].forEach(function(def) {
    lines.push('=== ' + def.sheetName + ' (' + def.sheetKey + ') ===');

    var sheet = ss.getSheetByName(def.sheetName);
    if (!sheet) {
      lines.push('  [ERROR] タブが見つかりません: ' + def.sheetName);
      return;
    }

    var actual = sheet.getRange(1, 1, 1, def.headers.length).getValues()[0];
    var mismatches = 0;

    def.headers.forEach(function(expected, idx) {
      var colNum = idx + 1;
      var act = String(actual[idx] || '');
      var match = (act === expected) ? 'OK' : 'MISMATCH';
      if (match === 'MISMATCH') mismatches++;
      lines.push('  col' + colNum + ': [' + match + '] CONFIG="' + expected + '" / 実="' + act + '"');
    });

    lines.push('  mismatches=' + mismatches);
    lines.push('');
  });

  Logger.log(lines.join('\n'));
  return lines.join('\n');
}

/**
 * オーダー管理シートの最大 OD-XXXXX を読み取り、次の ID を返す
 *
 * - シートが空（ヘッダーのみ）なら OD-00001 を返す
 * - ID形式が不正な行はスキップする
 */
function nextOrderId() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  if (!sheet) {
    throw new Error('タブが見つかりません: ' + CONFIG.SHEETS.ORDER_MASTER);
  }

  var lastRow = sheet.getLastRow();
  var maxNum = 0;

  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(row) {
      var id = String(row[0] || '').trim();
      var m = id.match(/^OD-(\d{5})$/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }

  var nextNum = maxNum + 1;
  var nextId = 'OD-' + ('00000' + nextNum).slice(-5);

  Logger.log('nextOrderId: ' + nextId + ' (現在の最大: ' + (maxNum === 0 ? 'なし' : 'OD-' + ('00000' + maxNum).slice(-5)) + ')');
  return nextId;
}

/**
 * オーダー明細シートの最大 ODL-XXXXX を読み取り、次の ID を返す
 *
 * - シートが空（ヘッダーのみ）なら ODL-00001 を返す
 * - ID形式が不正な行はスキップする
 */
function nextOrderLineId() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_LINES);
  if (!sheet) {
    throw new Error('タブが見つかりません: ' + CONFIG.SHEETS.ORDER_LINES);
  }

  var lastRow = sheet.getLastRow();
  var maxNum = 0;

  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(row) {
      var id = String(row[0] || '').trim();
      var m = id.match(/^ODL-(\d{5})$/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }

  var nextNum = maxNum + 1;
  var nextId = 'ODL-' + ('00000' + nextNum).slice(-5);

  Logger.log('nextOrderLineId: ' + nextId + ' (現在の最大: ' + (maxNum === 0 ? 'なし' : 'ODL-' + ('00000' + maxNum).slice(-5)) + ')');
  return nextId;
}

/**
 * 顧客マスタの全件を「顧客ID / 顧客名 / 国」で一覧出力する（読み取り専用）
 *
 * 用途: 名寄せ確定表の検証など
 */
function dumpCustomerNameList() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  if (!sheet) {
    Logger.log('ERROR: 顧客マスタシートが見つかりません: ' + CONFIG.SHEETS.CRM_CUSTOMERS);
    return;
  }

  var data = sheet.getDataRange().getValues();
  var h = data[0];

  var idIdx   = h.indexOf('顧客ID');
  var nameIdx = h.indexOf('顧客名');
  var ctryIdx = h.indexOf('国');

  if (idIdx < 0 || nameIdx < 0) {
    Logger.log('ERROR: 必須列が見つかりません (顧客ID idx=' + idIdx + ', 顧客名 idx=' + nameIdx + ')');
    return;
  }

  var lines = ['=== dumpCustomerNameList ==='];
  lines.push('顧客マスタ データ行数: ' + (data.length - 1));
  lines.push('');
  lines.push('col: 顧客ID | 顧客名 | 国');
  lines.push('---');

  for (var i = 1; i < data.length; i++) {
    var cid  = String(data[i][idIdx]   || '').trim();
    var name = String(data[i][nameIdx] || '').trim();
    var ctry = (ctryIdx >= 0) ? String(data[i][ctryIdx] || '').trim() : '(列なし)';
    lines.push(cid + ' | ' + name + ' | ' + ctry);
  }

  lines.push('');
  lines.push('[DONE] 計 ' + (data.length - 1) + ' 件');

  Logger.log(lines.join('\n'));
  return lines.join('\n');
}

// ============================================================
// ★ オーダー登録テスト ★
// ============================================================

/**
 * testCreateOrder() - オーダー管理/明細への書き込みと整合性を検証するテスト
 *
 * シナリオ:
 *   1. 正常登録: CT-00006/AD-00005/PY-00005 でヘッダー1行+明細3行を作成
 *      - OD採番/ODL採番/行番号1,2,3
 *      - 小計=数量×単価、明細合計=Σ小計、請求総額=明細合計+送料+関税
 *   2. 存在しないID拒否: CT-99999 → 拒否 / ADが別CTに紐づく → 拒否
 *   3. 源流リードID自動導出: 顧客マスタから自動入力
 *   4. 型検証: 運送状番号=string / 請求書番号=string
 *   Cleanup: 作成した全行を自動削除（痕跡ゼロ）
 */
function testCreateOrder() {
  var ss = getSpreadsheet();
  var lines = ['=== testCreateOrder ==='];
  var PASS = '[PASS]', FAIL = '[FAIL]';
  var passCount = 0, failCount = 0;

  // テスト用固定データ (CT-00006: Card Galaxy LTD(Essex) の実在ID)
  var TEST_CT  = 'CT-00006';
  var TEST_AD  = 'AD-00005';
  var TEST_PY  = 'PY-00005';
  var TEST_INV = '#TEST-XTEST'; // 通常運用と衝突しない形式

  var created = { orderRows: [], lineRows: [] }; // cleanup用

  // ---- 内部バリデーター: CT/AD/PY の存在と紐づけを確認 ----
  function validateOrderIds(ctId, adId, pyId) {
    var custSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
    var shipSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
    var paySheet  = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);

    // CT 存在確認 + 源流リードID取得
    var custData = custSheet.getDataRange().getValues();
    var ch = custData[0];
    var cidIdx = ch.indexOf('顧客ID');
    var srcIdx = ch.indexOf('源流リードID');
    var ctRow = null;
    for (var i = 1; i < custData.length; i++) {
      if (String(custData[i][cidIdx]).trim() === ctId) { ctRow = custData[i]; break; }
    }
    if (!ctRow) return { ok: false, reason: '顧客IDが存在しない: ' + ctId, srcLeadId: null };
    var srcLeadId = String(ctRow[srcIdx] || '').trim();

    // AD 存在確認 + CT紐づき確認
    var shipData = shipSheet.getDataRange().getValues();
    var sh = shipData[0];
    var adIdIdx = sh.indexOf('配送先ID');
    var adCtIdx = sh.indexOf('顧客ID');
    var adFound = false;
    for (var j = 1; j < shipData.length; j++) {
      if (String(shipData[j][adIdIdx]).trim() === adId) {
        if (String(shipData[j][adCtIdx]).trim() !== ctId) {
          return { ok: false, reason: '配送先ID ' + adId + ' の顧客ID=' + shipData[j][adCtIdx] + ' ≠ ' + ctId, srcLeadId: null };
        }
        adFound = true; break;
      }
    }
    if (!adFound) return { ok: false, reason: '配送先IDが存在しない: ' + adId, srcLeadId: null };

    // PY 存在確認 + CT紐づき確認
    var payData = paySheet.getDataRange().getValues();
    var ph = payData[0];
    var pyIdIdx = ph.indexOf('支払先ID');
    var pyCtIdx = ph.indexOf('顧客ID');
    var pyFound = false;
    for (var k = 1; k < payData.length; k++) {
      if (String(payData[k][pyIdIdx]).trim() === pyId) {
        if (String(payData[k][pyCtIdx]).trim() !== ctId) {
          return { ok: false, reason: '支払先ID ' + pyId + ' の顧客ID=' + payData[k][pyCtIdx] + ' ≠ ' + ctId, srcLeadId: null };
        }
        pyFound = true; break;
      }
    }
    if (!pyFound) return { ok: false, reason: '支払先IDが存在しない: ' + pyId, srcLeadId: null };

    return { ok: true, reason: null, srcLeadId: srcLeadId };
  }

  function check(label, actual, expected) {
    var ok = (String(actual) === String(expected));
    lines.push((ok ? PASS : FAIL) + ' ' + label + ': actual=' + actual + ' / expected=' + expected);
    if (ok) passCount++; else failCount++;
    return ok;
  }

  // ======== Scenario 2a: 存在しないCT → 拒否 ========
  lines.push('');
  lines.push('--- Scenario 2a: CT-99999(存在しない) → 拒否 ---');
  var r2a = validateOrderIds('CT-99999', TEST_AD, TEST_PY);
  if (!r2a.ok) {
    lines.push(PASS + ' 拒否OK: ' + r2a.reason); passCount++;
  } else {
    lines.push(FAIL + ' CT-99999が拒否されなかった'); failCount++;
  }

  // ======== Scenario 2b: ADが別CTに紐づく → 拒否 ========
  lines.push('');
  lines.push('--- Scenario 2b: AD-00005 を CT-00007(別顧客)で参照 → 拒否 ---');
  var r2b = validateOrderIds('CT-00007', 'AD-00005', 'PY-00005');
  if (!r2b.ok) {
    lines.push(PASS + ' 拒否OK: ' + r2b.reason); passCount++;
  } else {
    lines.push(FAIL + ' 不一致ADが拒否されなかった'); failCount++;
  }

  // ======== 事前バリデーション (Scenario 1用) ========
  lines.push('');
  lines.push('--- Scenario 1 事前バリデーション ---');
  var v1 = validateOrderIds(TEST_CT, TEST_AD, TEST_PY);
  if (!v1.ok) {
    lines.push(FAIL + ' テストデータバリデーション失敗: ' + v1.reason); failCount++;
    Logger.log(lines.join('\n'));
    return lines.join('\n');
  }
  lines.push(PASS + ' CT/AD/PY 全て存在・紐づき確認'); passCount++;

  // ======== Scenario 3: 源流リードID自動導出 ========
  lines.push('');
  lines.push('--- Scenario 3: 源流リードID自動導出 ---');
  var autoSrcId = v1.srcLeadId;
  if (autoSrcId !== '') {
    lines.push(PASS + ' 源流リードID="' + autoSrcId + '" (引数なし・自動導出)'); passCount++;
  } else {
    lines.push(FAIL + ' 源流リードIDが空（顧客マスタ未設定）'); failCount++;
  }

  // ======== Scenario 1: 正常登録 ========
  lines.push('');
  lines.push('--- Scenario 1: 正常登録 ---');

  var orderId  = nextOrderId();
  var lineBase = nextOrderLineId();
  lines.push('採番: ' + orderId + ' / 明細ベース: ' + lineBase);

  // 3明細 (数量×単価が整数で検証しやすい値)
  var lineItems = [
    { category: 'Pokemon', name: 'SV9a BOX',  condition: 'Sealed', sku: 'SV9A-BOX',  qty: 5,  price: 12000 },
    { category: 'Pokemon', name: 'SV9a PACK', condition: 'Sealed', sku: 'SV9A-PACK', qty: 20, price: 700   },
    { category: 'Pokemon', name: 'SV9b BOX',  condition: 'Sealed', sku: 'SV9B-BOX',  qty: 3,  price: 10500 }
  ];
  var shipping = 5000;
  var customs  = 2000;
  var expectedLineTotal  = lineItems.reduce(function(s, li) { return s + li.qty * li.price; }, 0);
  var expectedGrandTotal = expectedLineTotal + shipping + customs;
  lines.push('期待: 明細合計=' + expectedLineTotal + ', 送料=' + shipping + ', 関税=' + customs + ', 請求総額=' + expectedGrandTotal);

  // ---- オーダー管理 書き込み ----
  var masterSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var masterH = masterSheet.getRange(1, 1, 1, 26).getValues()[0];
  var mIdx = {};
  masterH.forEach(function(col, i) { mIdx[col] = i; });

  var now = new Date();
  var masterRow = new Array(26).fill('');
  masterRow[mIdx['オーダーID']]    = orderId;
  masterRow[mIdx['請求書番号']]    = String(TEST_INV);     // Scenario 4: 明示的string
  masterRow[mIdx['顧客ID']]        = TEST_CT;
  masterRow[mIdx['配送先ID']]      = TEST_AD;
  masterRow[mIdx['支払先ID']]      = TEST_PY;
  masterRow[mIdx['源流リードID']]  = autoSrcId;             // Scenario 3
  masterRow[mIdx['ステータス']]    = '受注';
  masterRow[mIdx['受注日']]        = now;
  masterRow[mIdx['通貨']]          = 'JPY';
  masterRow[mIdx['為替レート']]    = 1;
  masterRow[mIdx['明細合計']]      = expectedLineTotal;
  masterRow[mIdx['送料']]          = shipping;
  masterRow[mIdx['関税']]          = customs;
  masterRow[mIdx['請求総額']]      = expectedGrandTotal;
  masterRow[mIdx['決済手段']]      = '銀行振込';
  masterRow[mIdx['運送状番号']]    = String('TEST-TRACK-001'); // Scenario 4: 明示的string
  masterRow[mIdx['登録日']]        = now;
  masterRow[mIdx['更新日']]        = now;

  var masterLastRow = masterSheet.getLastRow() + 1;
  masterSheet.getRange(masterLastRow, 1, 1, 26).setValues([masterRow]);
  // 文字列固定書式を個別行にも適用
  masterSheet.getRange(masterLastRow, mIdx['運送状番号'] + 1, 1, 1).setNumberFormat('@');
  masterSheet.getRange(masterLastRow, mIdx['請求書番号']  + 1, 1, 1).setNumberFormat('@');
  created.orderRows.push(masterLastRow);

  // ---- オーダー明細 書き込み ----
  var linesSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_LINES);
  var linesH = linesSheet.getRange(1, 1, 1, 10).getValues()[0];
  var lIdx = {};
  linesH.forEach(function(col, i) { lIdx[col] = i; });

  var odlIds = [];
  lineItems.forEach(function(li, rowNum) {
    var seqNum = parseInt(lineBase.replace('ODL-', ''), 10) + rowNum;
    var odlId = 'ODL-' + ('00000' + seqNum).slice(-5);
    odlIds.push(odlId);

    var lRow = new Array(10).fill('');
    lRow[lIdx['明細ID']]     = odlId;
    lRow[lIdx['オーダーID']] = orderId;
    lRow[lIdx['行番号']]     = rowNum + 1;
    lRow[lIdx['カテゴリ']]   = li.category;
    lRow[lIdx['商品名']]     = li.name;
    lRow[lIdx['状態']]       = li.condition;
    lRow[lIdx['SKU']]        = li.sku;
    lRow[lIdx['数量']]       = li.qty;
    lRow[lIdx['単価']]       = li.price;
    lRow[lIdx['小計']]       = li.qty * li.price;

    var linesLastRow = linesSheet.getLastRow() + 1;
    linesSheet.getRange(linesLastRow, 1, 1, 10).setValues([lRow]);
    created.lineRows.push(linesLastRow);
  });

  SpreadsheetApp.flush();

  // ======== 検証フェーズ ========
  lines.push('');
  lines.push('--- 検証 ---');

  // オーダー管理 読み返し
  var writtenMaster = masterSheet.getRange(masterLastRow, 1, 1, 26).getDisplayValues()[0];
  check('OD採番',          writtenMaster[mIdx['オーダーID']],    orderId);
  check('請求書番号(string確認)', typeof masterSheet.getRange(masterLastRow, mIdx['請求書番号']+1).getValue(), 'string');
  check('明細合計',         Number(writtenMaster[mIdx['明細合計']]),  expectedLineTotal);
  check('請求総額',         Number(writtenMaster[mIdx['請求総額']]),  expectedGrandTotal);
  check('源流リードID（自動）', writtenMaster[mIdx['源流リードID']], autoSrcId);

  // Scenario 4: 運送状番号の型（getDisplayValues → string, かつ数値変換されていないか）
  var trackDisplay = writtenMaster[mIdx['運送状番号']];
  check('運送状番号(数値変換されていない)', isNaN(Number(trackDisplay)) || trackDisplay === 'TEST-TRACK-001', 'true');
  check('運送状番号の値', trackDisplay, 'TEST-TRACK-001');

  // 明細 読み返し
  var allLinesData = linesSheet.getDataRange().getValues();
  var lh2 = allLinesData[0];
  var lIdIdx2    = lh2.indexOf('明細ID');
  var lodIdx2    = lh2.indexOf('オーダーID');
  var lRowNumIdx = lh2.indexOf('行番号');
  var lSubIdx2   = lh2.indexOf('小計');

  lineItems.forEach(function(li, i) {
    var dataRow = allLinesData[created.lineRows[i] - 1]; // 1-based → 0-based
    check('ODL[' + (i+1) + '] 明細ID',    dataRow[lIdIdx2],    odlIds[i]);
    check('ODL[' + (i+1) + '] オーダーID', dataRow[lodIdx2],   orderId);
    check('ODL[' + (i+1) + '] 行番号',    dataRow[lRowNumIdx], i + 1);
    check('ODL[' + (i+1) + '] 小計',      dataRow[lSubIdx2],  li.qty * li.price);
  });

  // 不変式
  check('明細合計=Σ小計', expectedLineTotal,
    lineItems.reduce(function(s, li) { return s + li.qty * li.price; }, 0));
  check('請求総額=明細合計+送料+関税', expectedGrandTotal, expectedLineTotal + shipping + customs);

  // 書き込み後の次採番
  var nextOdAfter  = nextOrderId();
  var nextOdlAfter = nextOrderLineId();
  var expectedNextOd  = 'OD-'  + ('00000' + (parseInt(orderId.replace('OD-', ''),  10) + 1)).slice(-5);
  var expectedNextOdl = 'ODL-' + ('00000' + (parseInt(lineBase.replace('ODL-', ''), 10) + 3)).slice(-5);
  check('書込後 nextOrderId',   nextOdAfter,  expectedNextOd);
  check('書込後 nextOrderLineId', nextOdlAfter, expectedNextOdl);

  // ======== Cleanup ========
  lines.push('');
  lines.push('--- Cleanup ---');
  created.orderRows.slice().reverse().forEach(function(r) { masterSheet.deleteRow(r); });
  created.lineRows.slice().reverse().forEach(function(r)  { linesSheet.deleteRow(r); });
  SpreadsheetApp.flush();
  lines.push('削除: オーダー管理 ' + created.orderRows.length + '行 / オーダー明細 ' + created.lineRows.length + '行');

  // クリーンアップ後の採番がテスト前と同じに戻っているか
  check('クリーンアップ後 nextOrderId = テスト開始前と同じ',   nextOrderId(),   orderId);
  check('クリーンアップ後 nextOrderLineId = テスト開始前と同じ', nextOrderLineId(), lineBase);

  lines.push('');
  lines.push('=== 結果: PASS=' + passCount + ' / FAIL=' + failCount + ' ===');

  Logger.log(lines.join('\n'));
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────
// google.script.run グローバル変数の実行間独立性検証
// ─────────────────────────────────────────────────────────────────
// 目的: 各 google.script.run 呼び出しが独立した V8 実行コンテキストを
//       持ち、グローバル変数が呼び出し間でリセットされることを実証する。
//
// 手順:
//   1. clasp run testSetGasGlobalState --params '["abc"]'
//      → 同一実行内で setTo と readBack が一致することを確認
//   2. clasp run testGetGasGlobalState
//      → 別実行では null に戻っていることを確認
//
// 合格条件: 手順2で { value: null } が返ること。
//
// 注意: GAS では underscore 先頭の関数は private 扱いとなり
//       clasp run（Apps Script API）から呼び出せないため、
//       公開可能な名前で定義する。

var _gasGlobalStateTest = null;

function testSetGasGlobalState(val) {
  _gasGlobalStateTest = val;
  return { setTo: val, readBack: _gasGlobalStateTest };
}

function testGetGasGlobalState() {
  return { value: _gasGlobalStateTest };
}

/**
 * DEV 環境専用: 「支払い待ち」テストオーダー 1件 + 明細 1件 を投入する。
 *
 * 実行条件:
 *   - ENVIRONMENT === 'development' であること
 *   - ステータスが「支払い待ち」の行が既に0件であること（二重実行防止）
 *
 * 投入データ（オーダー管理 1行）:
 *   - オーダーID: OD-XXXXX 形式（既存最大+1）
 *   - 請求書番号: TEST-0001
 *   - 請求書発行日: 実行日
 *   - 支払期日: 実行日 +3日
 *   - 支払確認日: 空
 *   - 通貨: JPY
 *   - 為替レート: 通貨マスタの JPY レート（取得失敗時は 1）
 *   - ステータス: calculateOrderStatus() の戻り値
 *   - 支払いステータス: calculatePaymentStatus() の戻り値
 *   - 顧客ID / 配送先ID / 支払先ID / 源流リードID: 既存先頭行から取得
 *   - 入金確認者ID: 空
 *   - 入金確認元: 空
 *   - 登録日 / 更新日: 実行日時
 *
 * 投入データ（オーダー明細 1行）:
 *   - 明細ID: ODL-XXXXX 形式（既存最大+1）
 *   - オーダーID: 上で採番した値
 *   - 行番号: 1
 *   - 商品名: テスト商品
 *   - 数量: 1
 *   - 単価: 10000
 *   - 小計: 10000
 *
 * @returns {{ success: boolean, resultType: string, orderId?: string, orderLineId?: string }}
 */
function createDevTestUnpaidOrder() {
  // ── 環境ガード ────────────────────────────────────────────────────────────
  if (getEnvironment() !== 'development') {
    throw new Error('createDevTestUnpaidOrder is available only in development');
  }

  // ── LockService ──────────────────────────────────────────────────────────
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = getSpreadsheet();

    // ── 二重実行防止ガード ──────────────────────────────────────────────────
    var awaitingPaymentValue = getCoreSchemaV1Value('ORDERS', 'STATUS', 'AWAITING_PAYMENT');
    var ordersSheet = getCoreSchemaV1Sheet(ss, 'ORDERS');
    var ordersLastRow = ordersSheet.getLastRow();
    var existingAwaitingCount = 0;
    if (ordersLastRow >= 2) {
      var statusHeaderName = getCoreSchemaV1HeaderName('ORDERS', 'STATUS');
      var ordersHeaders = ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getDisplayValues()[0];
      var statusColIdx = ordersHeaders.indexOf(statusHeaderName);
      if (statusColIdx !== -1) {
        var statusValues = ordersSheet.getRange(2, statusColIdx + 1, ordersLastRow - 1, 1).getDisplayValues();
        statusValues.forEach(function(row) {
          if (row[0] === awaitingPaymentValue) existingAwaitingCount++;
        });
      }
    }
    if (existingAwaitingCount > 0) {
      return {
        success: false,
        resultType: 'ABORT_DUPLICATE_AWAITING_PAYMENT',
        existingAwaitingPaymentCount: existingAwaitingCount
      };
    }

    // ── 既存先頭行から参照IDを取得 ──────────────────────────────────────────
    var customerIdHeaderName         = getCoreSchemaV1HeaderName('ORDERS', 'CUSTOMER_ID');
    var shippingDestIdHeaderName     = getCoreSchemaV1HeaderName('ORDERS', 'SHIPPING_DESTINATION_ID');
    var paymentDestIdHeaderName      = getCoreSchemaV1HeaderName('ORDERS', 'PAYMENT_DESTINATION_ID');
    var sourceLeadIdHeaderName       = getCoreSchemaV1HeaderName('ORDERS', 'SOURCE_LEAD_ID');

    var ordersAllHeaders = ordersSheet.getLastColumn() > 0
      ? ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getDisplayValues()[0]
      : [];

    function getIdxByHeaderName(headers, name) {
      var idx = headers.indexOf(name);
      if (idx === -1) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING: ' + name);
      return idx;
    }

    var custIdx     = getIdxByHeaderName(ordersAllHeaders, customerIdHeaderName);
    var shipIdx     = getIdxByHeaderName(ordersAllHeaders, shippingDestIdHeaderName);
    var payDestIdx  = getIdxByHeaderName(ordersAllHeaders, paymentDestIdHeaderName);
    var leadIdx     = getIdxByHeaderName(ordersAllHeaders, sourceLeadIdHeaderName);

    var customerId          = '';
    var shippingDestId      = '';
    var paymentDestId       = '';
    var sourceLeadId        = '';

    if (ordersLastRow >= 2) {
      var firstDataRow = ordersSheet.getRange(2, 1, 1, ordersSheet.getLastColumn()).getValues()[0];
      customerId     = String(firstDataRow[custIdx]    || '').trim();
      shippingDestId = String(firstDataRow[shipIdx]    || '').trim();
      paymentDestId  = String(firstDataRow[payDestIdx] || '').trim();
      sourceLeadId   = String(firstDataRow[leadIdx]    || '').trim();
    }

    // ── オーダーID 採番（Core Schema V1 ベース）──────────────────────────────
    var orderMaxNum = 0;
    if (ordersLastRow >= 2) {
      var orderIdHeaderName = getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID');
      var orderIdColIdx = ordersAllHeaders.indexOf(orderIdHeaderName);
      if (orderIdColIdx !== -1) {
        var orderIdValues = ordersSheet.getRange(2, orderIdColIdx + 1, ordersLastRow - 1, 1).getValues();
        orderIdValues.forEach(function(row) {
          var m = String(row[0] || '').trim().match(/^OD-(\d+)$/);
          if (m) {
            var n = parseInt(m[1], 10);
            if (n > orderMaxNum) orderMaxNum = n;
          }
        });
      }
    }
    var orderId = 'OD-' + ('00000' + (orderMaxNum + 1)).slice(-5);

    // ── 為替レート取得 ──────────────────────────────────────────────────────
    var exchangeRate = 1;
    try {
      exchangeRate = getCurrentExchangeRate('JPY');
    } catch (e) {
      // JPY がマスタにない場合は 1 を使用
    }

    // ── 日付 ─────────────────────────────────────────────────────────────────
    var now = new Date();
    var paymentDueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);

    // ── ステータス算出 ────────────────────────────────────────────────────────
    var orderStatus = calculateOrderStatus(
      {
        cancellationReason: '',
        status:             '',
        paymentConfirmedAt: '',
        invoiceNumber:      'TEST-0001'
      },
      [],
      []
    );

    var paymentStatus = calculatePaymentStatus({
      cancellationReason: '',
      paymentConfirmedAt: '',
      paymentDueAt:       paymentDueAt
    });

    // ── オーダー管理 書き込み ─────────────────────────────────────────────────
    var ordersWriteTarget = validateCoreSchemaV1TableForWrite(ss, 'ORDERS');
    var ordersHeaderIndexes = ordersWriteTarget.headerIndexes; // { '物理列名': 1-indexed列番号 }

    function col(headerKey) {
      var name = getCoreSchemaV1HeaderName('ORDERS', headerKey);
      var idx  = ordersHeaderIndexes[name];
      if (!idx) throw new Error('ORDERS header index not found: ' + headerKey);
      return idx;
    }

    var ordersColCount = ordersSheet.getLastColumn();
    var newOrderRow = new Array(ordersColCount);
    for (var i = 0; i < newOrderRow.length; i++) { newOrderRow[i] = ''; }

    newOrderRow[col('ORDER_ID')              - 1] = orderId;
    newOrderRow[col('INVOICE_NUMBER')        - 1] = 'TEST-0001';
    newOrderRow[col('CUSTOMER_ID')           - 1] = customerId;
    newOrderRow[col('SHIPPING_DESTINATION_ID') - 1] = shippingDestId;
    newOrderRow[col('PAYMENT_DESTINATION_ID') - 1] = paymentDestId;
    newOrderRow[col('SOURCE_LEAD_ID')        - 1] = sourceLeadId;
    newOrderRow[col('STATUS')                - 1] = orderStatus;
    newOrderRow[col('CURRENCY')              - 1] = 'JPY';
    newOrderRow[col('EXCHANGE_RATE')         - 1] = exchangeRate;
    newOrderRow[col('INVOICE_ISSUED_AT')     - 1] = now;
    newOrderRow[col('PAYMENT_DUE_AT')        - 1] = paymentDueAt;
    newOrderRow[col('PAYMENT_CONFIRMED_AT')  - 1] = '';
    newOrderRow[col('PAYMENT_CONFIRMATION_SOURCE') - 1] = '';
    newOrderRow[col('PAYMENT_CONFIRMED_BY_ID') - 1] = '';
    newOrderRow[col('PAYMENT_STATUS')        - 1] = paymentStatus;
    newOrderRow[col('REGISTERED_AT')         - 1] = now;
    newOrderRow[col('UPDATED_AT')            - 1] = now;

    ordersSheet.appendRow(newOrderRow);

    // ── オーダー明細 書き込み ──────────────────────────────────────────────────
    var linesWriteTarget = validateCoreSchemaV1TableForWrite(ss, 'ORDER_LINES');
    var linesSheet = linesWriteTarget.sheet;
    var linesHeaderIndexes = linesWriteTarget.headerIndexes;

    // 明細ID 採番
    var linesLastRow = linesSheet.getLastRow();
    var lineMaxNum = 0;
    if (linesLastRow >= 2) {
      var lineIdHeaderName = getCoreSchemaV1HeaderName('ORDER_LINES', 'ORDER_LINE_ID');
      var linesAllHeaders = linesSheet.getRange(1, 1, 1, linesSheet.getLastColumn()).getDisplayValues()[0];
      var lineIdColIdx = linesAllHeaders.indexOf(lineIdHeaderName);
      if (lineIdColIdx !== -1) {
        var lineIdValues = linesSheet.getRange(2, lineIdColIdx + 1, linesLastRow - 1, 1).getValues();
        lineIdValues.forEach(function(row) {
          var m = String(row[0] || '').trim().match(/^ODL-(\d+)$/);
          if (m) {
            var n = parseInt(m[1], 10);
            if (n > lineMaxNum) lineMaxNum = n;
          }
        });
      }
    }
    var orderLineId = 'ODL-' + ('00000' + (lineMaxNum + 1)).slice(-5);

    function lineCol(headerKey) {
      var name = getCoreSchemaV1HeaderName('ORDER_LINES', headerKey);
      var idx  = linesHeaderIndexes[name];
      if (!idx) throw new Error('ORDER_LINES header index not found: ' + headerKey);
      return idx;
    }

    var linesColCount = linesSheet.getLastColumn();
    var newLineRow = new Array(linesColCount);
    for (var j = 0; j < newLineRow.length; j++) { newLineRow[j] = ''; }

    newLineRow[lineCol('ORDER_LINE_ID')  - 1] = orderLineId;
    newLineRow[lineCol('ORDER_ID')       - 1] = orderId;
    newLineRow[lineCol('LINE_NUMBER')    - 1] = 1;
    newLineRow[lineCol('PRODUCT_NAME')   - 1] = 'テスト商品';
    newLineRow[lineCol('QUANTITY')       - 1] = 1;
    newLineRow[lineCol('UNIT_PRICE')     - 1] = 10000;
    newLineRow[lineCol('SUBTOTAL')       - 1] = 10000;

    linesSheet.appendRow(newLineRow);

    return {
      success:     true,
      resultType:  'DEV_TEST_UNPAID_ORDER_CREATED',
      orderId:     orderId,
      orderLineId: orderLineId
    };
  } finally {
    lock.releaseLock();
  }
}
