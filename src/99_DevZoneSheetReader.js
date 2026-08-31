/**
 * 99_DevZoneSheetReader.js
 *
 * 目的: 地帯表シートの特定行を読み取る（DEV 専用 / 読み取り専用）
 *
 * 禁止事項:
 *   - シートへの書き込み（setValue / setValues / appendRow 等）
 *   - PROD 環境での実行
 *   - 全件返し（keyword なしでは実行できない）
 *
 * 使い方:
 *   clasp run readZoneSheetRows --params '["Martin"]'
 *   clasp run readZoneSheetRows --params '["China"]'
 */

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
