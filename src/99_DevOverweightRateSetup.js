/**
 * 99_DevOverweightRateSetup.js
 *
 * 目的:
 *   1. 配送会社マスタ（CARRIERS）に「単価開始重量」「超過計算方式」の2列を末尾追加する。
 *   2. 超過料金単価マスタ（OVERWEIGHT_UNIT_RATES）シートを新設する（ヘッダー行のみ）。
 *
 * 設計意図:
 *   - 配送会社ごとに単価計算の開始重量が異なるため、ハードコードせずマスタで持つ。
 *     （FedEx IP 21.0 / FICP 33.0 / DHL 30.1 / UPS 21.0）
 *   - 超過計算方式も会社ごとに異なるため values で管理する。
 *     MULTIPLY_ALL: 請求重量の全体 × 単価（出典: FedEx公式「キログラム単位料金」）
 *     ADD_TO_BASE:  上限重量の料金 ＋ 超過分 × 単価（出典: eLogi DHL「30kgを超える分…」）
 *   - PostgreSQL 移行時想定:
 *     UNIQUE(carrier_id, zone, package_type, min_weight, max_weight)
 *   - 既存3社（FedEx/DHL/UPS）は UNIT_RATE_FROM_KG / OVERWEIGHT_METHOD を空にする。
 *     空 = 単価計算なし。既存の動作は一切変わらない。
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - 既存3社の配送会社マスタの値を変更すること
 *   - 料金の値をシート・ログに書くこと
 *
 * 使い方:
 *   clasp run setupOverweightRateMaster --params '["DRY_RUN"]'
 *   clasp run setupOverweightRateMaster --params '["APPLY"]'
 */

// ============================================================
// 定数
// ============================================================

/**
 * 配送会社マスタに追加する2列のキー（Registry 定義済み）。
 * 既存列（API接続設定3列）の末尾に追加する。
 * ★ 既存3社への初期値は空（単価計算なし）。
 */
var CARRIER_OVERWEIGHT_COLUMN_KEYS = ['UNIT_RATE_FROM_KG', 'OVERWEIGHT_METHOD'];

var CARRIER_OVERWEIGHT_COLUMN_DEFAULTS = {
  UNIT_RATE_FROM_KG: '',
  OVERWEIGHT_METHOD: ''
};

// ============================================================
// メイン関数
// ============================================================

/**
 * 超過料金単価マスタを DRY_RUN または APPLY でセットアップする。
 *
 * DRY_RUN: 以下を報告（変更なし）
 *   - CARRIERS に追加予定の2列
 *   - OVERWEIGHT_UNIT_RATES シートの作成予定
 *
 * APPLY: 以下を実行
 *   1. CARRIERS に UNIT_RATE_FROM_KG / OVERWEIGHT_METHOD を末尾追加（既存3社は空）
 *   2. 超過料金単価マスタシートをヘッダー行のみで作成
 *      （データ投入は次のPR / clasp run addOverweightUnitRates で行う）
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function setupOverweightRateMaster(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }
  if (getEnvironment() !== 'development') {
    throw new Error('setupOverweightRateMaster は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();

  // --- CARRIERS 列追加の準備 ---
  var carriersTableKey = 'CARRIERS';
  var carriersTable    = getCoreSchemaV1Table(carriersTableKey);
  var carriersSheet    = getCoreSchemaV1Sheet(ss, carriersTableKey);
  var carriersLastCol  = carriersSheet.getLastColumn();
  var carriersHeaders  = carriersLastCol > 0
    ? carriersSheet.getRange(carriersTable.headerRowNumber, 1, 1, carriersLastCol)
        .getDisplayValues()[0].map(function(h) { return String(h).trim(); })
    : [];

  var colsToAdd = CARRIER_OVERWEIGHT_COLUMN_KEYS.filter(function(key) {
    return carriersHeaders.indexOf(carriersTable.headers[key]) === -1;
  });

  var carriersDataRowCount = Math.max(0, carriersSheet.getLastRow() - carriersTable.headerRowNumber);

  // --- OVERWEIGHT_UNIT_RATES シート新設の準備 ---
  var ratesTableKey  = 'OVERWEIGHT_UNIT_RATES';
  var ratesTable     = getCoreSchemaV1Table(ratesTableKey);
  var ratesSheetName = ratesTable.sheetName;
  var ratesHeaders   = Object.values(ratesTable.headers);
  var ratesExists    = ss.getSheetByName(ratesSheetName) !== null;

  Logger.log('=== setupOverweightRateMaster (' + mode + ') ===');
  Logger.log('');
  Logger.log('[CARRIERS 列追加]');
  Logger.log('  現在列数: ' + carriersHeaders.length);
  Logger.log('  追加予定: ' + colsToAdd.length + '列');
  colsToAdd.forEach(function(key) {
    Logger.log('    + ' + carriersTable.headers[key] + ' (key=' + key + ')');
  });
  Logger.log('  対象データ行数（初期値書き込み）: ' + carriersDataRowCount);
  Logger.log('');
  Logger.log('[OVERWEIGHT_UNIT_RATES シート新設]');
  Logger.log('  シート名: ' + ratesSheetName);
  Logger.log('  列数: ' + ratesHeaders.length);
  Logger.log('  既存シートとの衝突: ' + (ratesExists ? '★ あり（スキップ）' : 'なし'));
  Logger.log('  列: ' + ratesHeaders.join(' / '));

  if (mode === 'DRY_RUN') {
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際の変更は行っていません。');
    return {
      mode:            'DRY_RUN',
      carrierColsToAdd: colsToAdd.map(function(key) {
        return { key: key, displayName: carriersTable.headers[key] };
      }),
      carriersDataRowCount: carriersDataRowCount,
      overweightSheet: {
        name:    ratesSheetName,
        columns: ratesHeaders,
        exists:  ratesExists
      }
    };
  }

  // APPLY
  var result = { mode: 'APPLY', carrierCols: {}, overweightSheet: {} };

  // 1. CARRIERS 列追加
  if (colsToAdd.length === 0) {
    Logger.log('CARRIERS: 追加すべき列がありません（すでに完了済み）。');
    result.carrierCols = { added: 0, skipped: true };
  } else {
    var startCol = carriersLastCol + 1;
    colsToAdd.forEach(function(key, i) {
      carriersSheet.getRange(carriersTable.headerRowNumber, startCol + i)
        .setValue(carriersTable.headers[key]);
    });
    Logger.log('CARRIERS: ' + colsToAdd.length + '列のヘッダーを追加しました（列 ' +
      startCol + '〜' + (startCol + colsToAdd.length - 1) + '）。');

    if (carriersDataRowCount > 0) {
      var values = [];
      for (var r = 0; r < carriersDataRowCount; r++) {
        values.push(colsToAdd.map(function(key) {
          return CARRIER_OVERWEIGHT_COLUMN_DEFAULTS[key]; // 既存3社は空
        }));
      }
      carriersSheet.getRange(
        carriersTable.headerRowNumber + 1, startCol,
        carriersDataRowCount, colsToAdd.length
      ).setValues(values);
      Logger.log('CARRIERS: ' + carriersDataRowCount + '行に初期値（空）を書き込みました。');
    }
    result.carrierCols = { added: colsToAdd.length, skipped: false, dataRowCount: carriersDataRowCount };
  }

  // 2. OVERWEIGHT_UNIT_RATES シート新設
  if (ratesExists) {
    Logger.log('OVERWEIGHT_UNIT_RATES: シートはすでに存在するためスキップしました。');
    result.overweightSheet = { created: false, skipped: true, sheetName: ratesSheetName };
  } else {
    var newSheet  = ss.insertSheet(ratesSheetName);
    var targetRow = ratesTable.headerRowNumber; // = 1
    newSheet.getRange(targetRow, 1, 1, ratesHeaders.length).setValues([ratesHeaders]);
    Logger.log('OVERWEIGHT_UNIT_RATES: シートを作成しました（' + ratesHeaders.length + '列）。');
    result.overweightSheet = { created: true, skipped: false, sheetName: ratesSheetName, columnCount: ratesHeaders.length };
  }

  return result;
}
