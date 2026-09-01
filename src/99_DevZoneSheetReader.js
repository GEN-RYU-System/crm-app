/**
 * 99_DevZoneSheetReader.js
 *
 * 目的: 地帯表・料金表シートの行を読み取る（DEV 専用 / 読み取り専用）
 *
 * 禁止事項:
 *   - シートへの書き込み（setValue / setValues / appendRow 等）
 *   - PROD 環境での実行
 *   - 全件返し（keyword なしでは実行できない）
 *
 * 使い方:
 *   clasp run readZoneSheetRows --params '["Martin"]'
 *   clasp run readZoneSheetRows --params '["China"]'
 *   clasp run readRateSheetWeightBands --params '["FEDEX"]'
 *   clasp run readRateSheetWeightBands --params '["DHL"]'
 *   clasp run readRateSheetWeightBands --params '["UPS"]'
 */

/** 料金表シートの重量列ヘッダー名（実シートの1行目と合わせる） */
var RATE_SHEET_WEIGHT_COL = {
  MIN: 'Min_Weight',
  MAX: 'Max_Weight'
};

/** 地帯表の列ヘッダー名（実シートの1行目と合わせる） */
var ZONE_SHEET_COL = {
  JA_NAME: '国',
  EN_NAME: 'Country',
  FEDEX:   'FedEx',
  DHL:     'DHL',
  UPS:     'UPS'
};

/** 返却行数の上限 */
var ZONE_SHEET_READER_MAX_ROWS = 50;

/**
 * 地帯表シートから keyword を含む行を返す。
 * 「国」列・「Country」列の両方で検索する（大文字小文字を区別しない）。
 *
 * @param {string} keyword - 必須。空文字・省略不可。
 * @returns {Object} { sheetName, keyword, matched, rows } または
 *                   { sheetName, keyword, matched, note } (50件超時)
 */
function readZoneSheetRows(keyword) {
  if (!keyword || String(keyword).trim() === '') {
    throw new Error(
      'keyword は必須です。全件返しを防ぐため、引数なしでは実行できません。\n' +
      '例: clasp run readZoneSheetRows --params \'["Martin"]\''
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('readZoneSheetRows は development 環境でのみ実行できます。');
  }

  var ss        = getSpreadsheet();
  var sheetName = IMPORT_SOURCE_SHEET_NAMES.ZONES; // '地帯表' は 99_DevShippingRateDataImport.js で定義
  var sheet     = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName);
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    var empty = { sheetName: sheetName, keyword: keyword, matched: 0, rows: [] };
    Logger.log(JSON.stringify(empty, null, 2));
    return empty;
  }

  var headerRow = allData[0];

  // 列位置を indexOf で特定（列番号の直書き禁止）
  var jaIdx    = headerRow.indexOf(ZONE_SHEET_COL.JA_NAME);
  var enIdx    = headerRow.indexOf(ZONE_SHEET_COL.EN_NAME);
  var fedexIdx = headerRow.indexOf(ZONE_SHEET_COL.FEDEX);
  var dhlIdx   = headerRow.indexOf(ZONE_SHEET_COL.DHL);
  var upsIdx   = headerRow.indexOf(ZONE_SHEET_COL.UPS);

  if (jaIdx < 0 || enIdx < 0) {
    throw new Error(
      '地帯表のヘッダーが見つかりません。\n' +
      '「国」列: col' + (jaIdx + 1) + '\n' +
      '「Country」列: col' + (enIdx + 1) + '\n' +
      'ヘッダー実値: ' + JSON.stringify(headerRow)
    );
  }

  var kwLower  = String(keyword).toLowerCase();
  var dataRows = allData.slice(1);
  var matched  = [];

  dataRows.forEach(function(row) {
    var nameJa = String(row[jaIdx] != null ? row[jaIdx] : '');
    var nameEn = String(row[enIdx] != null ? row[enIdx] : '');

    if (nameJa.toLowerCase().indexOf(kwLower) !== -1 ||
        nameEn.toLowerCase().indexOf(kwLower) !== -1) {
      var entry = {};
      entry[ZONE_SHEET_COL.JA_NAME] = nameJa;
      entry[ZONE_SHEET_COL.EN_NAME] = nameEn;
      entry[ZONE_SHEET_COL.FEDEX]   = fedexIdx >= 0 ? String(row[fedexIdx] != null ? row[fedexIdx] : '') : '';
      entry[ZONE_SHEET_COL.DHL]     = dhlIdx   >= 0 ? String(row[dhlIdx]   != null ? row[dhlIdx]   : '') : '';
      entry[ZONE_SHEET_COL.UPS]     = upsIdx   >= 0 ? String(row[upsIdx]   != null ? row[upsIdx]   : '') : '';
      matched.push(entry);
    }
  });

  var result = {
    sheetName: sheetName,
    keyword:   keyword,
    matched:   matched.length
  };

  if (matched.length > ZONE_SHEET_READER_MAX_ROWS) {
    result.note = matched.length + '件が該当しました。' + ZONE_SHEET_READER_MAX_ROWS + '件超のため件数のみ報告します。';
  } else {
    result.rows = matched;
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * 料金表シート（FedEx送料 / DHL送料 / UPS送料）から
 * 重量帯（Min_Weight / Max_Weight）のみを返す。
 * 料金の値は返さない（契約料金のため）。
 *
 * @param {string} sheetKey - 'FEDEX' / 'DHL' / 'UPS' のいずれか（必須）
 * @returns {Object} { sheetName, sheetKey, rowCount, bands }
 *                   bands は { minWeight, maxWeight } の配列
 */
function readRateSheetWeightBands(sheetKey) {
  if (!sheetKey || String(sheetKey).trim() === '') {
    throw new Error(
      'sheetKey は必須です。引数なしでは実行できません。\n' +
      '例: clasp run readRateSheetWeightBands --params \'["FEDEX"]\''
    );
  }

  var key = String(sheetKey).trim().toUpperCase();
  if (key !== 'FEDEX' && key !== 'DHL' && key !== 'UPS') {
    throw new Error(
      'sheetKey は "FEDEX" / "DHL" / "UPS" のいずれかを指定してください。' +
      '受け取った値: ' + sheetKey
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('readRateSheetWeightBands は development 環境でのみ実行できます。');
  }

  // シート名は既存コードと同じ方法で取得（直書き禁止）
  var sheetName = IMPORT_SOURCE_SHEET_NAMES[key];
  var ss        = getSpreadsheet();
  var sheet     = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName + ' (sheetKey=' + key + ')');
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    var empty = { sheetName: sheetName, sheetKey: key, rowCount: 0, bands: [] };
    Logger.log(JSON.stringify(empty, null, 2));
    return empty;
  }

  var headerRow = allData[0];

  // 列位置を indexOf で特定（列番号の直書き禁止）
  var minIdx = headerRow.indexOf(RATE_SHEET_WEIGHT_COL.MIN);
  var maxIdx = headerRow.indexOf(RATE_SHEET_WEIGHT_COL.MAX);

  if (minIdx < 0 || maxIdx < 0) {
    throw new Error(
      '料金表のヘッダーが見つかりません。\n' +
      '"' + RATE_SHEET_WEIGHT_COL.MIN + '" 列: ' + (minIdx < 0 ? '不在' : 'col' + (minIdx + 1)) + '\n' +
      '"' + RATE_SHEET_WEIGHT_COL.MAX + '" 列: ' + (maxIdx < 0 ? '不在' : 'col' + (maxIdx + 1)) + '\n' +
      'ヘッダー実値: ' + JSON.stringify(headerRow)
    );
  }

  var dataRows = allData.slice(1);
  var bands    = [];

  dataRows.forEach(function(row) {
    var rawMin = row[minIdx];
    var rawMax = row[maxIdx];

    // 最小重量が空の行はスキップ（送料シートの末尾空行対策）
    if (rawMin === '' || rawMin === null || rawMin === undefined) return;

    var minWeight = Number(rawMin);
    if (isNaN(minWeight)) return;

    bands.push({
      minWeight: minWeight,
      maxWeight: Number(rawMax)
    });
  });

  var result = {
    sheetName: sheetName,
    sheetKey:  key,
    rowCount:  bands.length,
    bands:     bands
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
