/**
 * 99_DevShipmentLineSetup.js
 *
 * 目的:
 *   1. 発送明細シート（SHIPMENT_LINES）を新設する DEV 専用セットアップ。
 *   2. 商品荷姿マスタ（PRODUCT_PACKAGES）に原産国列を追加する。
 *
 * どちらも DRY_RUN（確認のみ）と APPLY（実際に変更）の2モードを持つ。
 *
 * 禁止事項:
 *   - 既存シートの変更・削除・上書き（addProductPackageOriginCountryColumn の列追加を除く）
 *   - PROD 環境での実行
 *   - 既存データ行への値の書き込み（addProductPackageOriginCountryColumn）
 *
 * 設計メモ（SQL 移行観点）:
 *   - 共用商品ID と 自社商品ID はどちらか一方のみ（バリデーションは API 層で実施）
 *   - 単価は持たない（オーダー明細から引く）
 *   - 原産国は国マスタの ISO2 コード。既定値 'JP'
 *   - ID 接頭辞: SL-0001（4桁連番）
 *
 * 使い方:
 *   clasp run setupShipmentLineSheet --params '["DRY_RUN"]'
 *   clasp run setupShipmentLineSheet --params '["APPLY"]'
 *   clasp run addProductPackageOriginCountryColumn --params '["DRY_RUN"]'
 *   clasp run addProductPackageOriginCountryColumn --params '["APPLY"]'
 */

// ============================================================
// 発送明細シートのセットアップ
// ============================================================

/**
 * 発送明細シートを DRY_RUN または APPLY で作成する。
 *
 * - 同名シートが存在する場合はスキップして報告する（上書きしない）
 * - ヘッダー行は Registry の表示名から取得する（直書き禁止）
 * - targetRow は setValues の前に確定する
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function setupShipmentLineSheet(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('setupShipmentLineSheet は development 環境でのみ実行できます。');
  }

  var tableKey = 'SHIPMENT_LINES';
  var table    = getCoreSchemaV1Table(tableKey);
  var ss       = getSpreadsheet();

  var sheetName     = table.sheetName;
  var headers       = Object.values(table.headers);
  var alreadyExists = ss.getSheetByName(sheetName) !== null;

  Logger.log('=== setupShipmentLineSheet (' + mode + ') ===');
  Logger.log('');
  Logger.log('対象シート: ' + sheetName);
  Logger.log('列数: ' + headers.length);
  Logger.log('列: ' + headers.join(' / '));
  Logger.log('既存シートとの衝突: ' + (alreadyExists ? '★ あり（スキップ）' : 'なし'));

  if (mode === 'DRY_RUN') {
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際のシート作成は行っていません。');
    return {
      mode:          'DRY_RUN',
      sheetName:     sheetName,
      columnCount:   headers.length,
      alreadyExists: alreadyExists,
      headers:       headers
    };
  }

  // APPLY
  if (alreadyExists) {
    Logger.log('');
    Logger.log('⏭️  ' + sheetName + ' は既に存在するためスキップしました。');
    return {
      mode:      'APPLY',
      created:   false,
      skipped:   true,
      sheetName: sheetName
    };
  }

  var newSheet  = ss.insertSheet(sheetName);
  var targetRow = table.headerRowNumber; // = 1（setValues の前に確定）
  newSheet.getRange(targetRow, 1, 1, headers.length).setValues([headers]);

  Logger.log('');
  Logger.log('✅ ' + sheetName + ' を作成しました（' + headers.length + '列）。');

  return {
    mode:        'APPLY',
    created:     true,
    skipped:     false,
    sheetName:   sheetName,
    columnCount: headers.length
  };
}

// ============================================================
// 商品荷姿マスタへの原産国列の追加
// ============================================================

/**
 * 商品荷姿マスタシートに原産国列（ORIGIN_COUNTRY）を末尾に追加する。
 * ★ DEV 環境専用。PROD では実行不可。
 * ★ 既存データ行への値の書き込みは行わない（意図的）。
 * ★ 二重実行防止: 列がすでに存在する場合はスキップ。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function addProductPackageOriginCountryColumn(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('addProductPackageOriginCountryColumn は development 環境でのみ実行できます。');
  }

  var ss       = getSpreadsheet();
  var tableKey = 'PRODUCT_PACKAGES';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

  var lastCol    = sheet.getLastColumn();
  var curHeaders = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); })
    : [];

  var targetHeaderName = table.headers['ORIGIN_COUNTRY'];
  var alreadyExists    = curHeaders.indexOf(targetHeaderName) !== -1;

  var lastRow      = sheet.getLastRow();
  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);

  Logger.log('=== addProductPackageOriginCountryColumn (' + mode + ') ===');
  Logger.log('');
  Logger.log('対象シート: ' + table.sheetName);
  Logger.log('現在の列数: ' + curHeaders.length);
  Logger.log('追加列: ' + targetHeaderName);
  Logger.log('既に存在: ' + alreadyExists);
  Logger.log('データ行数: ' + dataRowCount + '（既存行への値書き込みは行いません）');

  if (mode === 'DRY_RUN') {
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際の変更は行っていません。');
    return {
      mode:               'DRY_RUN',
      currentColumnCount: curHeaders.length,
      targetHeaderName:   targetHeaderName,
      alreadyExists:      alreadyExists,
      dataRowCount:       dataRowCount
    };
  }

  // APPLY
  if (alreadyExists) {
    Logger.log('追加すべき列がありません。すでに完了済みです。');
    return { mode: 'APPLY', added: 0 };
  }

  var addCol = lastCol + 1;
  sheet.getRange(table.headerRowNumber, addCol).setValue(targetHeaderName);

  Logger.log('');
  Logger.log('✅ 原産国列をヘッダー行に追加しました（列 ' + addCol + '）。');
  Logger.log('既存データ行への書き込みはスキップしました（意図的）。');

  return {
    mode:        'APPLY',
    added:       1,
    columnIndex: addCol,
    headerName:  targetHeaderName
  };
}
