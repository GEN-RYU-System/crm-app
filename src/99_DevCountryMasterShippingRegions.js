/**
 * 99_DevCountryMasterShippingRegions.js
 *
 * 目的: 国マスタ（国マスタシート）に配送会社が定義する独自地域6件を追加する。
 *       DEV 専用 / APPLY 前に DRY_RUN で確認すること。
 *
 * 追加する地域は ISO 3166-1 の正式コードではない。
 * FedEx / DHL / UPS が地帯表で独立した配送先として区別しているため、
 * 地帯マスタへの登録を可能にするために国マスタへ独自に追加する。
 * （CN-S は FedEx の中国南部定義に基づく: 福建省 350000-369999 /
 *   広東省 510000-529999。UPS の定義は未確認。）
 *
 * 禁止事項:
 *   - 既存行の変更（末尾追加のみ）
 *   - PROD 環境での実行
 *   - seedCountryMaster の実行（既存250行が消える）
 *
 * 使い方:
 *   clasp run addShippingRegionsToCountryMaster --params '["DRY_RUN"]'
 *   clasp run addShippingRegionsToCountryMaster --params '["APPLY"]'
 *
 * 注意: COUNTRIES テーブルは Registry 上 writeAllowed: false だが、
 *       本関数は DEV 専用セットアップのため直接 appendRow を使う。
 *       データ追加は git revert では戻らない（シートへの直接書き込み）。
 *       ロールバックが必要な場合はシートから手動で行を削除すること。
 */

/**
 * 追加する配送先地域定義（推測禁止・仕様書記載の通り）
 * トランク0除去=TRUE / 有効=TRUE / 州必須=FALSE / 郵便番号必須=FALSE
 */
var SHIPPING_REGIONS = [
  { COUNTRY_CODE: 'AC',   DISPLAY_NAME: 'Ascension Island',  NAME_JA: 'アセンション島',         COUNTRY_NUMBER: '247', STRIP_TRUNK_ZERO: 'TRUE', IS_ACTIVE: 'TRUE', STATE_REQUIRED: 'FALSE', ZIP_REQUIRED: 'FALSE' },
  { COUNTRY_CODE: 'IC',   DISPLAY_NAME: 'Canary Islands',    NAME_JA: 'カナリア諸島',           COUNTRY_NUMBER: '34',  STRIP_TRUNK_ZERO: 'TRUE', IS_ACTIVE: 'TRUE', STATE_REQUIRED: 'FALSE', ZIP_REQUIRED: 'FALSE' },
  { COUNTRY_CODE: 'TA',   DISPLAY_NAME: 'Tristan da Cunha',  NAME_JA: 'トリスタン・ダ・クーニャ', COUNTRY_NUMBER: '290', STRIP_TRUNK_ZERO: 'TRUE', IS_ACTIVE: 'TRUE', STATE_REQUIRED: 'FALSE', ZIP_REQUIRED: 'FALSE' },
  { COUNTRY_CODE: 'WK',   DISPLAY_NAME: 'Wake Island',       NAME_JA: 'ウェーキ島',             COUNTRY_NUMBER: '1',   STRIP_TRUNK_ZERO: 'TRUE', IS_ACTIVE: 'TRUE', STATE_REQUIRED: 'FALSE', ZIP_REQUIRED: 'FALSE' },
  { COUNTRY_CODE: 'MI',   DISPLAY_NAME: 'Midway Atoll',      NAME_JA: 'ミッドウェイ諸島',       COUNTRY_NUMBER: '1',   STRIP_TRUNK_ZERO: 'TRUE', IS_ACTIVE: 'TRUE', STATE_REQUIRED: 'FALSE', ZIP_REQUIRED: 'FALSE' },
  { COUNTRY_CODE: 'CN-S', DISPLAY_NAME: 'China (South)',     NAME_JA: '中国（南部）',           COUNTRY_NUMBER: '86',  STRIP_TRUNK_ZERO: 'TRUE', IS_ACTIVE: 'TRUE', STATE_REQUIRED: 'FALSE', ZIP_REQUIRED: 'FALSE' }
];

/**
 * 国マスタに配送先地域6件を追加する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function addShippingRegionsToCountryMaster(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。\n' +
      '例: clasp run addShippingRegionsToCountryMaster --params \'["DRY_RUN"]\''
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('addShippingRegionsToCountryMaster は development 環境でのみ実行できます。');
  }

  var ss    = getSpreadsheet();
  var table = getCoreSchemaV1Table('COUNTRIES');
  var sheet = getCoreSchemaV1Sheet(ss, 'COUNTRIES'); // シート名は Registry から取得

  // --- ヘッダー行読み取り（列順序の確定） ---
  var lastCol   = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // COUNTRY_CODE 列の位置を indexOf で特定（列番号の直書き禁止）
  var codeColName = table.headers['COUNTRY_CODE']; // 'country_code'
  var codeIdx     = headerRow.indexOf(codeColName);

  if (codeIdx < 0) {
    throw new Error(
      '国マスタに "' + codeColName + '" 列が見つかりません。\n' +
      'ヘッダー実値: ' + JSON.stringify(headerRow)
    );
  }

  // --- 既存の ISO2 コードを収集（重複チェック用） ---
  var lastRow      = sheet.getLastRow();
  var existingCodes = {};

  if (lastRow > 1) {
    var dataRange = sheet.getRange(2, codeIdx + 1, lastRow - 1, 1).getValues();
    dataRange.forEach(function(row) {
      var code = String(row[0] || '').trim();
      if (code) existingCodes[code] = true;
    });
  }

  // --- 追加予定とスキップを分類 ---
  var headerKeys = Object.keys(table.headers); // Registry キー順 = 列順

  var toAdd    = [];
  var toSkip   = [];

  SHIPPING_REGIONS.forEach(function(region) {
    if (existingCodes[region.COUNTRY_CODE]) {
      toSkip.push(region.COUNTRY_CODE);
    } else {
      // targetRow を appendRow の前に確定する
      var rowValues = headerKeys.map(function(key) {
        return region[key] !== undefined ? region[key] : '';
      });
      toAdd.push({ code: region.COUNTRY_CODE, rowValues: rowValues, displayName: region.DISPLAY_NAME });
    }
  });

  // --- ログ出力 ---
  Logger.log('=== addShippingRegionsToCountryMaster (' + mode + ') ===');
  Logger.log('');
  Logger.log('【追加予定: ' + toAdd.length + '件】');
  toAdd.forEach(function(item) {
    Logger.log('  ' + item.code + ' / ' + item.displayName);
    Logger.log('  ' + JSON.stringify(item.rowValues));
  });
  Logger.log('');
  Logger.log('【スキップ（既存）: ' + toSkip.length + '件】');
  toSkip.forEach(function(code) {
    Logger.log('  ' + code + ' — 既に存在するためスキップ');
  });

  if (mode === 'DRY_RUN') {
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際の書き込みは行っていません。');
    return {
      mode:       'DRY_RUN',
      toAddCount:  toAdd.length,
      skipCount:   toSkip.length,
      toAdd:       toAdd.map(function(i) { return { code: i.code, displayName: i.displayName, rowValues: i.rowValues }; }),
      skip:        toSkip
    };
  }

  // --- APPLY: 末尾に appendRow ---
  var added = [];

  toAdd.forEach(function(item) {
    sheet.appendRow(item.rowValues);
    Logger.log('  ✅ ' + item.code + ' (' + item.displayName + ') を追加しました。');
    added.push(item.code);
  });

  Logger.log('');
  Logger.log('APPLY 完了。追加: ' + added.length + '件 / スキップ: ' + toSkip.length + '件');

  return {
    mode:       'APPLY',
    addedCount:  added.length,
    skipCount:   toSkip.length,
    added:       added,
    skip:        toSkip
  };
}
