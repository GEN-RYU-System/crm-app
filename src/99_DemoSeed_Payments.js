/**
 * DEV 環境専用: 支払先マスタ デモシード
 *
 * 実測列定義 (auditDevCoreSchemaV1HeaderDetailV3 2026-08-26 実測):
 *   sheetName=支払先マスタ | columnCount=16
 *   1:支払先ID | 2:顧客ID | 3:表示名 | 4:請求名義 | 5:Address 1 | 6:Address 2 |
 *   7:Address 3 | 8:City | 9:State | 10:Zip | 11:国 | 12:支払方法 | 13:通貨 |
 *   14:B Tax ID | 15:既定 | 16:有効
 *
 * 投入内容:
 *   - PY-90001 〜 PY-90100 の支払先を 100 件挿入する
 *   - 既存の 2 行目以降を全削除してから挿入（べき等）
 *
 * ID 採番規則:
 *   支払先ID : PY-90001〜PY-90100  (90000 + n, ゼロ埋め 5 桁)
 *   顧客ID   : CS-90001〜CS-90100
 *
 * データ仕様:
 *   表示名 / 請求名義 : 'デモ商事 001'〜'デモ商事 100'
 *   支払方法          : n%2===0 → Wise / n%2===1 → PayPal
 *   通貨              : n%2===0 → JPY  / n%2===1 → USD
 *   国                : n%3===0 → Japan / n%3===1 → USA / n%3===2 → Australia
 *   既定 / 有効       : 全件 true
 *
 * 実行方法:
 *   clasp run seedDemoPaymentsDryRun  ← 確認用（書き込みなし）
 *   clasp run seedDemoPayments        ← POがまとめて実行
 *
 * 戻り値:
 *   { success: true, resultType: 'DEMO_SEED_PAYMENTS_DONE', insertedCount: 100 }
 */

// ─────────────────────────────────────────────────────────────────────────────
// ドライラン（書き込みなし・件数確認用）
// ─────────────────────────────────────────────────────────────────────────────
function seedDemoPaymentsDryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('seedDemoPaymentsDryRun は development 環境専用です');
  }

  var ss = getSpreadsheet();
  var sheet = getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS');

  var currentRowCount = sheet.getLastRow();
  Logger.log('[DemoSeed_Payments DryRun] 支払先マスタ 現在行数: ' + currentRowCount
    + ' (ヘッダー含む, データ行数=' + Math.max(0, currentRowCount - 1) + ')');

  // ID 衝突チェック
  var conflictIds = _getDemoPaymentConflicts_(sheet);
  if (conflictIds.length > 0) {
    Logger.log('[DemoSeed_Payments DryRun] ★ ID衝突検出: ' + conflictIds.join(', '));
  } else {
    Logger.log('[DemoSeed_Payments DryRun] ID衝突なし（PY-90001〜PY-90100 はクリア）');
  }

  var rows = _buildDemoPaymentRows_(sheet);
  Logger.log('[DemoSeed_Payments DryRun] 挿入予定件数: ' + rows.length);

  return {
    success:           true,
    resultType:        'DEMO_SEED_PAYMENTS_DRY_RUN',
    currentDataRows:   Math.max(0, currentRowCount - 1),
    conflictIdCount:   conflictIds.length,
    conflictIds:       conflictIds,
    plannedInsertCount: rows.length
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 本番シード（2行目以降削除 → 100件挿入）
// ─────────────────────────────────────────────────────────────────────────────
function seedDemoPayments() {
  if (getEnvironment() !== 'development') {
    throw new Error('seedDemoPayments は development 環境専用です');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = getSpreadsheet();
    var sheet = getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS');

    // ── 実行前に現在行数をログ出力 ──────────────────────────────────────────
    var currentRowCount = sheet.getLastRow();
    Logger.log('[DemoSeed_Payments] 支払先マスタ 実行前行数: ' + currentRowCount
      + ' (ヘッダー含む, データ行数=' + Math.max(0, currentRowCount - 1) + ')');

    // ── ID 衝突チェック ────────────────────────────────────────────────────
    var conflictIds = _getDemoPaymentConflicts_(sheet);
    if (conflictIds.length > 0) {
      throw new Error('[DemoSeed_Payments] ID衝突のため停止。既存ID: ' + conflictIds.join(', '));
    }

    // ── 2 行目以降を全削除 ────────────────────────────────────────────────
    if (currentRowCount >= 2) {
      sheet.deleteRows(2, currentRowCount - 1);
    }

    // ── 100 件のデモデータを構築して一括挿入 ──────────────────────────────
    var rows = _buildDemoPaymentRows_(sheet);
    var lastCol = sheet.getLastColumn();
    sheet.getRange(2, 1, rows.length, lastCol).setValues(rows);

    Logger.log('[DemoSeed_Payments] 挿入完了: ' + rows.length + '件');

    return {
      success:       true,
      resultType:    'DEMO_SEED_PAYMENTS_DONE',
      insertedCount: rows.length
    };

  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 内部ヘルパー: PY-90001〜PY-90100 と衝突する既存 ID を返す
// ─────────────────────────────────────────────────────────────────────────────
function _getDemoPaymentConflicts_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var idColIdx = headers.indexOf('支払先ID');
  if (idColIdx === -1) return [];  // ヘッダーなし → チェック不能（後続でエラーになる）

  var idValues = sheet.getRange(2, idColIdx + 1, lastRow - 1, 1).getValues();
  var demoRange = {};
  for (var n = 1; n <= 100; n++) {
    demoRange['PY-' + ('00000' + (90000 + n)).slice(-5)] = true;
  }

  return idValues
    .map(function(r) { return String(r[0] || '').trim(); })
    .filter(function(id) { return demoRange[id] === true; });
}

// ─────────────────────────────────────────────────────────────────────────────
// 内部ヘルパー: 100 件分の行データを構築して返す
// ─────────────────────────────────────────────────────────────────────────────
function _buildDemoPaymentRows_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) throw new Error('支払先マスタ: ヘッダー行が空です');

  // 実測列名で位置を解決
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  function colIdx(name) {
    var idx = headers.indexOf(name);
    if (idx === -1) throw new Error('支払先マスタ: ヘッダーが見つかりません: "' + name + '"');
    return idx;
  }

  // 実測列 (auditDevCoreSchemaV1HeaderDetailV3 2026-08-26):
  // 1:支払先ID | 2:顧客ID | 3:表示名 | 4:請求名義 | 5:Address 1 | 6:Address 2 |
  // 7:Address 3 | 8:City | 9:State | 10:Zip | 11:国 | 12:支払方法 | 13:通貨 |
  // 14:B Tax ID | 15:既定 | 16:有効
  var i支払先ID  = colIdx('支払先ID');
  var i顧客ID    = colIdx('顧客ID');
  var i表示名    = colIdx('表示名');
  var i請求名義  = colIdx('請求名義');
  var iAddr1     = colIdx('Address 1');
  var iAddr2     = colIdx('Address 2');
  var iAddr3     = colIdx('Address 3');
  var iCity      = colIdx('City');
  var iState     = colIdx('State');
  var iZip       = colIdx('Zip');
  var i国        = colIdx('国');
  var i支払方法  = colIdx('支払方法');
  var i通貨      = colIdx('通貨');
  var iTaxId     = colIdx('B Tax ID');
  var i既定      = colIdx('既定');
  var i有効      = colIdx('有効');

  var COUNTRIES = ['Japan', 'USA', 'Australia'];  // n%3 → 0:Japan, 1:USA, 2:Australia

  var rows = [];
  for (var n = 1; n <= 100; n++) {
    var id5       = ('00000' + (90000 + n)).slice(-5);   // '90001'〜'90100'
    var nameLabel = ('000' + n).slice(-3);               // '001'〜'100'

    var billingName   = 'デモ商事 ' + nameLabel;
    var country       = COUNTRIES[n % 3];
    var paymentMethod = (n % 2 === 0) ? 'Wise' : 'PayPal';
    var currency      = (n % 2 === 0) ? 'JPY'  : 'USD';

    var row = new Array(lastCol);
    for (var c = 0; c < row.length; c++) { row[c] = ''; }

    row[i支払先ID] = 'PY-' + id5;
    row[i顧客ID]   = 'CS-' + id5;
    row[i表示名]   = billingName;
    row[i請求名義] = billingName;
    row[iAddr1]    = 'デモ市デモ町 1-1-1';
    row[iAddr2]    = '';
    row[iAddr3]    = '';
    row[iCity]     = 'デモ市';
    row[iState]    = '';
    row[iZip]      = '000-0000';
    row[i国]       = country;
    row[i支払方法] = paymentMethod;
    row[i通貨]     = currency;
    row[iTaxId]    = '';
    row[i既定]     = true;
    row[i有効]     = true;

    rows.push(row);
  }

  return rows;
}
