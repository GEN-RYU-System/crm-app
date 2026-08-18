/**
 * 通貨マスタ のシート作成と初期データ投入
 *
 * setupCurrencyMasterSheet()
 *   - 既存タブがあれば何もしない（ALREADY_EXISTS を返す）
 *   - ヘッダーは Core Schema V1 の定義から生成（物理ヘッダー名の直書きなし）
 *   - LockService で保護
 *
 * seedCurrencyMaster()
 *   - データが既に1行以上あれば何もしない
 *   - JPY/USD/EUR/GBP/AUD の5行を投入
 *   - レートは GOOGLEFINANCE 数式で書き込む（JPY のみ数値 1）
 *   - LockService で保護
 *
 * ★ 実行は配布後に指示を待つこと
 */

function setupCurrencyMasterSheet() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss        = getSpreadsheet();
    var tableKey  = 'CURRENCIES';
    var table     = getCoreSchemaV1Table(tableKey);
    var sheetName = table.sheetName;

    if (ss.getSheetByName(sheetName)) {
      Logger.log('[setupCurrencyMasterSheet] ' + sheetName + ' は既に存在します。何もしません。');
      return { status: 'ALREADY_EXISTS', sheetName: sheetName };
    }

    var headerKeys  = Object.keys(table.headers);
    var headerNames = headerKeys.map(function(k) { return table.headers[k]; });

    var sheet = ss.insertSheet(sheetName);
    sheet.getRange(table.headerRowNumber, 1, 1, headerNames.length).setValues([headerNames]);
    sheet.getRange(table.headerRowNumber, 1, 1, headerNames.length)
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    Logger.log('[setupCurrencyMasterSheet] 作成完了: ' + sheetName + ' (' + headerNames.length + '列)');
    return { status: 'CREATED', sheetName: sheetName, columns: headerNames.length };
  } finally {
    lock.releaseLock();
  }
}

function seedCurrencyMaster() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss       = getSpreadsheet();
    var tableKey = 'CURRENCIES';
    var table    = getCoreSchemaV1Table(tableKey);
    var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

    var dataRowCount = sheet.getLastRow() - table.headerRowNumber;
    if (dataRowCount > 0) {
      Logger.log('[seedCurrencyMaster] データが既に存在します（' + dataRowCount + '行）。何もしません。');
      return { status: 'ALREADY_SEEDED', rows: dataRowCount };
    }

    var lastCol     = sheet.getLastColumn();
    var rawHeaders  = lastCol > 0
      ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getValues()[0]
      : [];

    function colOf(headerKey) {
      var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
      var idx  = rawHeaders.indexOf(name);
      if (idx === -1) throw new Error('HEADER_NOT_FOUND:' + headerKey);
      return idx + 1; // 1-based
    }

    var colCurrencyCode = colOf('CURRENCY_CODE');
    var colSymbol       = colOf('SYMBOL');
    var colName         = colOf('NAME');
    var colRateToJpy    = colOf('RATE_TO_JPY');
    var colIsActive     = colOf('IS_ACTIVE');

    var seeds = [
      { code: 'JPY', symbol: '\u00a5',  name: '\u65e5\u672c\u5186',   numRate: 1,    formula: null,                              active: true },
      { code: 'USD', symbol: '$',        name: '\u7c73\u30c9\u30eb',   numRate: null, formula: '=GOOGLEFINANCE("CURRENCY:USDJPY")', active: true },
      { code: 'EUR', symbol: '\u20ac',   name: '\u30e6\u30fc\u30ed',   numRate: null, formula: '=GOOGLEFINANCE("CURRENCY:EURJPY")', active: true },
      { code: 'GBP', symbol: '\u00a3',   name: '\u82f1\u30dd\u30f3\u30c9', numRate: null, formula: '=GOOGLEFINANCE("CURRENCY:GBPJPY")', active: true },
      { code: 'AUD', symbol: 'A$',       name: '\u8c6a\u30c9\u30eb',   numRate: null, formula: '=GOOGLEFINANCE("CURRENCY:AUDJPY")', active: true },
    ];

    var startRow = table.headerRowNumber + 1;

    seeds.forEach(function(seed, i) {
      var row = startRow + i;
      sheet.getRange(row, colCurrencyCode).setValue(seed.code);
      sheet.getRange(row, colSymbol).setValue(seed.symbol);
      sheet.getRange(row, colName).setValue(seed.name);
      if (seed.numRate !== null) {
        sheet.getRange(row, colRateToJpy).setValue(seed.numRate);
      } else {
        sheet.getRange(row, colRateToJpy).setFormula(seed.formula);
      }
      sheet.getRange(row, colIsActive).setValue(seed.active);
    });

    Logger.log('[seedCurrencyMaster] 投入完了: ' + seeds.length + '件');
    return { status: 'SEEDED', rows: seeds.length };
  } finally {
    lock.releaseLock();
  }
}
