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
    { sheet: '顧客マスタ',   col: 'Country' },
    { sheet: '配送先マスタ', col: 'Country' },
    { sheet: '支払先マスタ', col: 'Country' }
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
