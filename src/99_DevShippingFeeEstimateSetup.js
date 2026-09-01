/**
 * 99_DevShippingFeeEstimateSetup.js
 *
 * 目的: 送料見積履歴シート（SHIPPING_FEE_ESTIMATES）を新設し、
 *       配送会社マスタに API 接続設定3列を追加する DEV 専用セットアップ。
 *       読み取り専用の DRY_RUN と、実際にシートを操作する APPLY の2モードを持つ。
 *
 * 禁止事項:
 *   - 既存シートの変更・削除・上書き（addCarrierApiColumns の列追加を除く）
 *   - PROD 環境での実行
 *   - 認証キーの実値をシート・コード・ログに書くこと
 *     （API_AUTH_KEY_NAME は Script Properties のキー名のみを保持する）
 *
 * SQL 移行メモ:
 *   - 送料見積履歴の見積ID / 請求書ID / 発送ID を3列に分けているのは、
 *     SQL で外部キーを個別に宣言できる形にするため
 *     （1列ポリモーフィック関連では外部キー宣言が不可能）
 *   - CALC_SOURCE / FEE_TYPE は SQL 移行後 ENUM または参照テーブルになる
 *   - API_AUTH_KEY_NAME に保持する認証情報は SQL 移行後に環境変数へ移行する
 *
 * 使い方:
 *   clasp run setupShippingFeeEstimateSheet --params '["DRY_RUN"]'
 *   clasp run setupShippingFeeEstimateSheet --params '["APPLY"]'
 *   clasp run addCarrierApiColumns --params '["DRY_RUN"]'
 *   clasp run addCarrierApiColumns --params '["APPLY"]'
 */

// ============================================================
// 定数
// ============================================================

/**
 * 配送会社マスタに追加する API 接続設定3列のヘッダーキー（Registry に定義済み）。
 * 既存11列の末尾に追加する。
 */
var CARRIER_API_COLUMN_KEYS = ['API_ENABLED', 'API_ENDPOINT', 'API_AUTH_KEY_NAME'];

/**
 * 追加列に書き込む初期値（3社とも同じ値）。
 *
 * ★ API_AUTH_KEY_NAME には認証キーの実値を書かない。
 *    GAS Script Properties に登録したキー名（文字列）のみを保持する設計。
 *    初期値は '' （未設定）。
 */
var CARRIER_API_COLUMN_DEFAULTS = {
  API_ENABLED:      '',
  API_ENDPOINT:     '',
  API_AUTH_KEY_NAME: ''
};

// ============================================================
// 送料見積履歴シートのセットアップ
// ============================================================

/**
 * 送料見積履歴シートを DRY_RUN または APPLY で作成する。
 *
 * - 同名シートが存在する場合はスキップして報告する（上書きしない）
 * - ヘッダー行は Registry の表示名から取得する（直書き禁止）
 * - targetRow は setValues の前に確定する
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function setupShippingFeeEstimateSheet(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('setupShippingFeeEstimateSheet は development 環境でのみ実行できます。');
  }

  var tableKey = 'SHIPPING_FEE_ESTIMATES';
  var table    = getCoreSchemaV1Table(tableKey);
  var ss       = getSpreadsheet();

  var sheetName      = table.sheetName;
  var headers        = Object.values(table.headers);
  var alreadyExists  = ss.getSheetByName(sheetName) !== null;

  Logger.log('=== setupShippingFeeEstimateSheet (' + mode + ') ===');
  Logger.log('');
  Logger.log('対象シート: ' + sheetName);
  Logger.log('列数: ' + headers.length);
  Logger.log('列: ' + headers.join(' / '));
  Logger.log('既存シートとの衝突: ' + (alreadyExists ? '★ あり（スキップ）' : 'なし'));

  if (mode === 'DRY_RUN') {
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際のシート作成は行っていません。');
    return {
      mode:         'DRY_RUN',
      sheetName:    sheetName,
      columnCount:  headers.length,
      alreadyExists: alreadyExists,
      headers:      headers
    };
  }

  // APPLY
  if (alreadyExists) {
    Logger.log('');
    Logger.log('⏭️  ' + sheetName + ' は既に存在するためスキップしました。');
    return {
      mode:    'APPLY',
      created: false,
      skipped: true,
      sheetName: sheetName
    };
  }

  var newSheet  = ss.insertSheet(sheetName);
  var targetRow = table.headerRowNumber; // = 1（setValues の前に確定）
  newSheet.getRange(targetRow, 1, 1, headers.length).setValues([headers]);

  Logger.log('');
  Logger.log('✅ ' + sheetName + ' を作成しました（' + headers.length + '列）。');

  return {
    mode:    'APPLY',
    created: true,
    skipped: false,
    sheetName:   sheetName,
    columnCount: headers.length
  };
}

// ============================================================
// 配送会社マスタへの API 接続設定列の追加
// ============================================================

/**
 * 配送会社マスタシートに3列（API有効 / APIエンドポイント / API認証キー名）を
 * 追加し、既存データ行に初期値（すべて ''）を書き込む。
 * ★ DEV 環境専用。PROD では実行不可。
 * ★ 二重実行防止: 3列がすでに存在する場合はスキップ。
 * ★ API_AUTH_KEY_NAME には認証キーの実値を書かない。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function addCarrierApiColumns(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }
  if (getEnvironment() !== 'development') {
    throw new Error('addCarrierApiColumns は development 環境でのみ実行できます。');
  }

  var ss       = getSpreadsheet();
  var tableKey = 'CARRIERS';
  var table    = getCoreSchemaV1Table(tableKey);
  var sheet    = getCoreSchemaV1Sheet(ss, tableKey);

  // 現在のシートヘッダーを取得
  var lastCol    = sheet.getLastColumn();
  var curHeaders = lastCol > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getDisplayValues()[0]
        .map(function(h) { return String(h).trim(); })
    : [];

  // 追加すべき列を特定（Registry 定義の表示名で照合）
  var toAdd = CARRIER_API_COLUMN_KEYS.filter(function(key) {
    return curHeaders.indexOf(table.headers[key]) === -1;
  });

  // 既存データ行数
  var lastRow      = sheet.getLastRow();
  var dataRowCount = Math.max(0, lastRow - table.headerRowNumber);

  Logger.log('=== addCarrierApiColumns (' + mode + ') ===');
  Logger.log('現在の列数: ' + curHeaders.length);
  Logger.log('追加予定列: ' + toAdd.length + '件');
  toAdd.forEach(function(key) {
    Logger.log('  + ' + table.headers[key] + ' = ' + JSON.stringify(CARRIER_API_COLUMN_DEFAULTS[key]));
  });
  Logger.log('対象データ行数: ' + dataRowCount);

  if (mode === 'DRY_RUN') {
    Logger.log('DRY_RUN 完了。実際の変更は行っていません。');
    return {
      mode:               'DRY_RUN',
      currentColumnCount: curHeaders.length,
      toAdd:              toAdd.map(function(key) {
        return {
          headerKey:   key,
          displayName: table.headers[key],
          value:       CARRIER_API_COLUMN_DEFAULTS[key]
        };
      }),
      dataRowCount: dataRowCount
    };
  }

  // APPLY
  if (toAdd.length === 0) {
    Logger.log('追加すべき列がありません。すでに完了済みです。');
    return { mode: 'APPLY', added: 0, updated: 0 };
  }

  // 部分追加チェック: 一部だけ存在する場合は異常
  var alreadyPresent = CARRIER_API_COLUMN_KEYS.filter(function(key) {
    return curHeaders.indexOf(table.headers[key]) !== -1;
  });
  if (alreadyPresent.length > 0 && alreadyPresent.length < CARRIER_API_COLUMN_KEYS.length) {
    throw new Error(
      'PARTIAL_COLUMNS_DETECTED: ' + alreadyPresent.length + '/' + CARRIER_API_COLUMN_KEYS.length +
      ' 列が既に存在します。シートを手動確認してください。'
    );
  }

  // ヘッダー行に新列を一括追加
  var startCol = curHeaders.length + 1;
  toAdd.forEach(function(key, i) {
    sheet.getRange(table.headerRowNumber, startCol + i).setValue(table.headers[key]);
  });
  Logger.log(toAdd.length + '列のヘッダーを追加しました（列 ' + startCol + '〜' + (startCol + toAdd.length - 1) + '）。');

  // データ行に初期値を一括書き込み
  if (dataRowCount === 0) {
    Logger.log('データ行がありません。値の書き込みをスキップします。');
    return { mode: 'APPLY', added: toAdd.length, updated: 0 };
  }

  var values = [];
  for (var r = 0; r < dataRowCount; r++) {
    values.push(toAdd.map(function(key) { return CARRIER_API_COLUMN_DEFAULTS[key]; }));
  }
  sheet.getRange(table.headerRowNumber + 1, startCol, dataRowCount, toAdd.length).setValues(values);
  Logger.log(dataRowCount + '行に初期値を書き込みました。');

  return { mode: 'APPLY', added: toAdd.length, updated: dataRowCount };
}
