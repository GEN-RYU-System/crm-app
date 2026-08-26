/**
 * DEV 環境専用 デモデータ投入スクリプト (2026-08-26)
 *
 * 関数一覧:
 *   prepareCustomerMasterBackup_20260826  顧客マスタを複製してバックアップ作成 + ID差分確認
 *   seedDevDemoData_20260826              8タブのデモデータを一括投入
 *
 * 実行順序:
 *   1. clasp run prepareCustomerMasterBackup_20260826  → バックアップ作成 & 2-1 合格確認
 *   2. clasp run seedDevDemoData_20260826              → デモデータ投入
 *
 * 制約:
 *   - ENVIRONMENT === 'development' のみ実行可能
 *   - clearContent() を使用（deleteRows() 禁止）
 *   - PII なし（架空の顧客名・メール・電話番号を使用）
 *   - STATUS / PAYMENT_STATUS は calculateOrderStatus() / calculatePaymentStatus() で算出
 */

// ============================================================
// prepareCustomerMasterBackup_20260826
//
// PO 指示（2026-08-26 spec 2-1 修正）に基づき、
// 顧客マスタ を同一スプレッドシート内で複製して
// 顧客マスタ_pre_demo_20260826 を作成する。
// 複製後に 元タブ と 複製タブ の
//   nonEmptyDataRowCount / columnCount / ヘッダー行
// が一致することを確認し、結果を返す。
// 併せて 顧客マスタ と Copy of 顧客マスタ の 顧客ID 差分を返す。
//
// 合格条件: checks.passed === true
// 不合格なら停止し PO に報告する。
// ============================================================
function prepareCustomerMasterBackup_20260826() {
  var env = getEnvironment();
  if (env !== 'development') {
    throw new Error('ENVIRONMENT guard: expected development, got ' + env);
  }

  var ss = getSpreadsheet();

  var originalSheet = ss.getSheetByName('顧客マスタ');
  if (!originalSheet) {
    throw new Error('シート "顧客マスタ" が見つかりません');
  }

  var existingBackup = ss.getSheetByName('顧客マスタ_pre_demo_20260826');
  if (existingBackup) {
    throw new Error('バックアップタブ "顧客マスタ_pre_demo_20260826" が既に存在します。手動確認が必要です。');
  }

  // 複製
  var backupSheet = originalSheet.copyTo(ss);
  backupSheet.setName('顧客マスタ_pre_demo_20260826');
  SpreadsheetApp.flush();

  function auditSheetForBackup(sheet) {
    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var nonEmptyCount = 0;
    if (lastRow > 1 && lastCol > 0) {
      var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        for (var j = 0; j < row.length; j++) {
          if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
            nonEmptyCount++;
            break;
          }
        }
      }
    }
    return {
      name: sheet.getName(),
      gid: sheet.getSheetId(),
      columnCount: lastCol,
      nonEmptyDataRowCount: nonEmptyCount,
      headers: headers
    };
  }

  var origAudit = auditSheetForBackup(originalSheet);
  var backAudit = auditSheetForBackup(backupSheet);

  var columnMatch = origAudit.columnCount === backAudit.columnCount;
  var rowMatch    = origAudit.nonEmptyDataRowCount === backAudit.nonEmptyDataRowCount;
  var headerMatch = JSON.stringify(origAudit.headers) === JSON.stringify(backAudit.headers);
  var passed      = columnMatch && rowMatch && headerMatch;

  // 顧客ID 差分: 顧客マスタ vs Copy of 顧客マスタ
  var copyOfSheet = ss.getSheetByName('Copy of 顧客マスタ');
  if (!copyOfSheet) {
    throw new Error('シート "Copy of 顧客マスタ" が見つかりません');
  }

  function getColumnIndex(sheet, headerName) {
    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) return -1;
    var hdrs = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    return hdrs.indexOf(headerName);
  }

  function collectIds(sheet, colIdx) {
    var lastRow = sheet.getLastRow();
    var ids = [];
    var emptyIdRows = 0;
    if (lastRow > 1 && colIdx >= 0) {
      var vals = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i][0];
        var s = (v === null || v === undefined) ? '' : String(v).trim();
        if (s === '') {
          emptyIdRows++;
        } else {
          ids.push(s);
        }
      }
    }
    return { ids: ids, emptyIdRows: emptyIdRows };
  }

  var origColIdx   = getColumnIndex(originalSheet, '顧客ID');
  var copyOfColIdx = getColumnIndex(copyOfSheet, '顧客ID');

  var origResult   = collectIds(originalSheet, origColIdx);
  var copyOfResult = collectIds(copyOfSheet, copyOfColIdx);

  var copyOfIdSet = {};
  copyOfResult.ids.forEach(function(id) { copyOfIdSet[id] = true; });

  var origIdSet = {};
  origResult.ids.forEach(function(id) { origIdSet[id] = true; });

  var onlyInOriginal = origResult.ids.filter(function(id) { return !copyOfIdSet[id]; });
  var onlyInCopyOf   = copyOfResult.ids.filter(function(id) { return !origIdSet[id]; });

  return {
    backupCreated: {
      name: backAudit.name,
      gid: backAudit.gid
    },
    checks: {
      originalNonEmptyRows: origAudit.nonEmptyDataRowCount,
      backupNonEmptyRows:   backAudit.nonEmptyDataRowCount,
      originalColumnCount:  origAudit.columnCount,
      backupColumnCount:    backAudit.columnCount,
      columnMatch:  columnMatch,
      rowMatch:     rowMatch,
      headerMatch:  headerMatch,
      passed:       passed
    },
    customerIdDiff: {
      originalCount:         origResult.ids.length,
      copyOfCount:           copyOfResult.ids.length,
      emptyIdRowsInOriginal: origResult.emptyIdRows,
      emptyIdRowsInCopyOf:   copyOfResult.emptyIdRows,
      onlyInOriginal:        onlyInOriginal,
      onlyInCopyOf:          onlyInCopyOf
    }
  };
}

// ============================================================
// seedDevDemoData_20260826
//
// DEV スプレッドシートの 8 タブにデモ用架空データを投入する。
//
// 投入件数:
//   リード管理: 10件
//   顧客マスタ:  6件
//   支払先マスタ: 6件
//   配送先マスタ: 6件
//   オーダー管理: 12件
//   オーダー明細: 25件
//   仕入れ:     12件
//   発送:        8件
//
// STATUS / PAYMENT_STATUS は
// calculateOrderStatus() / calculatePaymentStatus() で算出する。
//
// 実行条件:
//   - ENVIRONMENT === 'development'
//   - SPREADSHEET_ID が DEV スプレッドシートと一致
//   - prepareCustomerMasterBackup_20260826() 実行済み（バックアップ存在確認）
// ============================================================
function seedDevDemoData_20260826() {
  // ── 環境ガード ────────────────────────────────────────────
  if (getEnvironment() !== 'development') {
    throw new Error('ENVIRONMENT guard: seedDevDemoData_20260826 は development のみ実行可能');
  }

  var ss = getSpreadsheet();
  if (ss.getId() !== getRequiredScriptProperty('SPREADSHEET_ID')) {
    throw new Error('SPREADSHEET_ID guard: 想定外のスプレッドシートです。実行を中止します。');
  }

  // バックアップ存在確認
  if (!ss.getSheetByName('顧客マスタ_pre_demo_20260826')) {
    throw new Error('バックアップタブ "顧客マスタ_pre_demo_20260826" が存在しません。' +
      'prepareCustomerMasterBackup_20260826() を先に実行してください。');
  }

  // ── LockService ───────────────────────────────────────────
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // ── 共通ヘルパー ──────────────────────────────────────────

    // シートのヘッダー行を取得（1行目、0-indexed 配列）
    function getSheetHeaders(sheet) {
      var lastCol = sheet.getLastColumn();
      if (lastCol === 0) return [];
      return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }

    // 行オブジェクト配列をシートに書き込む
    // rowObjects: [{ '日本語ヘッダー名': 値, ... }, ...]
    // ヘッダーに存在しないキーは無視する（列数の差異に対して安全）
    function writeDataRows(sheet, rowObjects) {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastCol === 0) return;
      // データ行（2行目以降）をクリア
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
      if (rowObjects.length === 0) return;
      var headers = getSheetHeaders(sheet);
      var matrix = rowObjects.map(function(rowObj) {
        var arr = new Array(lastCol).fill('');
        Object.keys(rowObj).forEach(function(key) {
          var idx = headers.indexOf(key);
          if (idx !== -1) arr[idx] = rowObj[key];
        });
        return arr;
      });
      sheet.getRange(2, 1, matrix.length, lastCol).setValues(matrix);
    }

    // ── デモ日付 ──────────────────────────────────────────────
    var D = {
      jan15: new Date('2026-01-15'),
      feb01: new Date('2026-02-01'),
      feb10: new Date('2026-02-10'),
      mar01: new Date('2026-03-01'),
      mar15: new Date('2026-03-15'),
      apr01: new Date('2026-04-01'),
      apr15: new Date('2026-04-15'),
      may01: new Date('2026-05-01'),
      may10: new Date('2026-05-10'),
      may20: new Date('2026-05-20'),
      jun01: new Date('2026-06-01'),
      jun05: new Date('2026-06-05'),
      jun10: new Date('2026-06-10'),
      jun12: new Date('2026-06-12'),
      jun15: new Date('2026-06-15'),
      jun20: new Date('2026-06-20'),
      jun30: new Date('2026-06-30'),
      jul01: new Date('2026-07-01'),
      jul05: new Date('2026-07-05'),
      jul10: new Date('2026-07-10'),
      jul15: new Date('2026-07-15'),
      jul20: new Date('2026-07-20'),
      jul31: new Date('2026-07-31'),
      aug01: new Date('2026-08-01'),
      aug10: new Date('2026-08-10'),
      aug26: new Date('2026-08-26'),
      sep15: new Date('2026-09-15'),
      sep20: new Date('2026-09-20')
    };

    // ── 1. LEADS（リード管理）10 件 ──────────────────────────
    var leadsSheet = getCoreSchemaV1Sheet(ss, 'LEADS');
    var leadsData = [
      {
        'リードID': 'LDI-0001', '登録日': D.jan15, '顧客名': 'Alex Thompson',
        'リード進捗': '成約', '商談進捗': '完了', '商談結果': '成約',
        '呼び方（英語）': 'Alex', '国': 'US', 'メール': 'alex.t@example.com',
        '連絡手段': 'Email', '温度感': '高', 'リードステータス': '成約済み'
      },
      {
        'リードID': 'LDI-0002', '登録日': D.feb01, '顧客名': 'Maria Garcia',
        'リード進捗': '成約', '商談進捗': '完了', '商談結果': '成約',
        '呼び方（英語）': 'Maria', '国': 'ES', 'メール': 'maria.g@example.com',
        '連絡手段': 'Email', '温度感': '高', 'リードステータス': '成約済み'
      },
      {
        'リードID': 'LDI-0003', '登録日': D.feb10, '顧客名': 'James Wilson',
        'リード進捗': '成約', '商談進捗': '完了', '商談結果': '成約',
        '呼び方（英語）': 'James', '国': 'GB', 'メール': 'james.w@example.com',
        '連絡手段': 'Discord', '温度感': '高', 'リードステータス': '成約済み'
      },
      {
        'リードID': 'LDI-0004', '登録日': D.mar01, '顧客名': 'Sophie Martin',
        'リード進捗': '成約', '商談進捗': '完了', '商談結果': '成約',
        '呼び方（英語）': 'Sophie', '国': 'FR', 'メール': 'sophie.m@example.com',
        '連絡手段': 'Email', '温度感': '高', 'リードステータス': '成約済み'
      },
      {
        'リードID': 'LDI-0005', '登録日': D.mar15, '顧客名': 'Hiroshi Tanaka',
        'リード進捗': '成約', '商談進捗': '完了', '商談結果': '成約',
        '呼び方（英語）': 'Hiroshi', '国': 'JP', 'メール': 'hiroshi.t@example.com',
        '連絡手段': 'LINE', '温度感': '高', 'リードステータス': '成約済み'
      },
      {
        'リードID': 'LDI-0006', '登録日': D.apr01, '顧客名': 'Emma Davis',
        'リード進捗': '成約', '商談進捗': '完了', '商談結果': '成約',
        '呼び方（英語）': 'Emma', '国': 'AU', 'メール': 'emma.d@example.com',
        '連絡手段': 'Email', '温度感': '高', 'リードステータス': '成約済み'
      },
      {
        'リードID': 'LDI-0007', '登録日': D.may01, '顧客名': 'Lucas Fernandez',
        'リード進捗': '商談中', '商談進捗': '提案済み', '商談結果': '',
        '呼び方（英語）': 'Lucas', '国': 'MX', 'メール': 'lucas.f@example.com',
        '連絡手段': 'Email', '温度感': '中', 'リードステータス': '商談中'
      },
      {
        'リードID': 'LDI-0008', '登録日': D.jun01, '顧客名': 'Olivia Brown',
        'リード進捗': '初回接触', '商談進捗': '未着手', '商談結果': '',
        '呼び方（英語）': 'Olivia', '国': 'CA', 'メール': 'olivia.b@example.com',
        '連絡手段': 'Email', '温度感': '低', 'リードステータス': '新規'
      },
      {
        'リードID': 'LDI-0009', '登録日': D.jul01, '顧客名': 'Noah Schmidt',
        'リード進捗': '商談中', '商談進捗': '見積もり提出', '商談結果': '',
        '呼び方（英語）': 'Noah', '国': 'DE', 'メール': 'noah.s@example.com',
        '連絡手段': 'Email', '温度感': '中', 'リードステータス': '商談中'
      },
      {
        'リードID': 'LDI-0010', '登録日': D.aug01, '顧客名': 'Chloe Anderson',
        'リード進捗': '失注', '商談進捗': '完了', '商談結果': '失注',
        '呼び方（英語）': 'Chloe', '国': 'NZ', 'メール': 'chloe.a@example.com',
        '連絡手段': 'Email', '温度感': '低', '失注理由': '価格', 'リードステータス': '失注'
      }
    ];
    writeDataRows(leadsSheet, leadsData);

    // ── 2. CUSTOMERS（顧客マスタ）6 件 ───────────────────────
    var customerSheet = getCoreSchemaV1Sheet(ss, 'CUSTOMERS');
    var customersData = [
      {
        '顧客ID': 'CT-0001', '源流リードID': 'LDI-0001', '顧客名': 'Alex Thompson',
        '国': 'US', 'メール': 'alex.t@example.com', '電話番号': '+1-555-0101',
        '国番号': '+1', '初回取引日': D.feb01, '登録日': D.feb01,
        '営業担当者': 'Demo Staff', '連絡ツール': 'Email'
      },
      {
        '顧客ID': 'CT-0002', '源流リードID': 'LDI-0002', '顧客名': 'Maria Garcia',
        '国': 'ES', 'メール': 'maria.g@example.com', '電話番号': '+34-555-0202',
        '国番号': '+34', '初回取引日': D.mar01, '登録日': D.mar01,
        '営業担当者': 'Demo Staff', '連絡ツール': 'Email'
      },
      {
        '顧客ID': 'CT-0003', '源流リードID': 'LDI-0003', '顧客名': 'James Wilson',
        '国': 'GB', 'メール': 'james.w@example.com', '電話番号': '+44-555-0303',
        '国番号': '+44', '初回取引日': D.apr01, '登録日': D.apr01,
        '営業担当者': 'Demo Staff', '連絡ツール': 'Discord'
      },
      {
        '顧客ID': 'CT-0004', '源流リードID': 'LDI-0004', '顧客名': 'Sophie Martin',
        '国': 'FR', 'メール': 'sophie.m@example.com', '電話番号': '+33-555-0404',
        '国番号': '+33', '初回取引日': D.may01, '登録日': D.may01,
        '営業担当者': 'Demo Staff', '連絡ツール': 'Email'
      },
      {
        '顧客ID': 'CT-0005', '源流リードID': 'LDI-0005', '顧客名': 'Hiroshi Tanaka',
        '国': 'JP', 'メール': 'hiroshi.t@example.com', '電話番号': '+81-555-0505',
        '国番号': '+81', '初回取引日': D.jun01, '登録日': D.jun01,
        '営業担当者': 'Demo Staff', '連絡ツール': 'LINE'
      },
      {
        '顧客ID': 'CT-0006', '源流リードID': 'LDI-0006', '顧客名': 'Emma Davis',
        '国': 'AU', 'メール': 'emma.d@example.com', '電話番号': '+61-555-0606',
        '国番号': '+61', '初回取引日': D.jul01, '登録日': D.jul01,
        '営業担当者': 'Demo Staff', '連絡ツール': 'Email'
      }
    ];
    writeDataRows(customerSheet, customersData);

    // ── 3. PAYMENT_DESTINATIONS（支払先マスタ）6 件 ──────────
    var paymentDestSheet = getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS');
    var paymentDestsData = [
      {
        '支払先ID': 'PD-0001', '顧客ID': 'CT-0001', '請求名義': 'Alex Thompson',
        'Address 1': '123 Main St', 'City': 'New York', 'State': 'NY',
        'Zip': '10001', '国': 'US', '支払方法': 'Wise', '通貨': 'USD',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '支払先ID': 'PD-0002', '顧客ID': 'CT-0002', '請求名義': 'Maria Garcia',
        'Address 1': '456 Calle Mayor', 'City': 'Madrid', 'State': 'Madrid',
        'Zip': '28001', '国': 'ES', '支払方法': 'Wise', '通貨': 'EUR',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '支払先ID': 'PD-0003', '顧客ID': 'CT-0003', '請求名義': 'James Wilson',
        'Address 1': '789 High Street', 'City': 'London', 'State': 'England',
        'Zip': 'SW1A 1AA', '国': 'GB', '支払方法': 'PayPal', '通貨': 'GBP',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '支払先ID': 'PD-0004', '顧客ID': 'CT-0004', '請求名義': 'Sophie Martin',
        'Address 1': '12 Rue de Rivoli', 'City': 'Paris', 'State': 'Île-de-France',
        'Zip': '75001', '国': 'FR', '支払方法': 'Wise', '通貨': 'EUR',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '支払先ID': 'PD-0005', '顧客ID': 'CT-0005', '請求名義': 'Hiroshi Tanaka',
        'Address 1': '東京都渋谷区デモ通り1-1', 'City': 'Tokyo', 'State': 'Tokyo',
        'Zip': '150-0001', '国': 'JP', '支払方法': 'Wise', '通貨': 'JPY',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '支払先ID': 'PD-0006', '顧客ID': 'CT-0006', '請求名義': 'Emma Davis',
        'Address 1': '321 George St', 'City': 'Sydney', 'State': 'NSW',
        'Zip': '2000', '国': 'AU', '支払方法': 'Wise', '通貨': 'AUD',
        '既定': 'TRUE', '有効': 'TRUE'
      }
    ];
    writeDataRows(paymentDestSheet, paymentDestsData);

    // ── 4. SHIPPING_DESTINATIONS（配送先マスタ）6 件 ─────────
    var shippingDestSheet = getCoreSchemaV1Sheet(ss, 'SHIPPING_DESTINATIONS');
    var shippingDestsData = [
      {
        '配送先ID': 'SD-0001', '顧客ID': 'CT-0001', '宛名': 'Alex Thompson',
        'Address 1': '123 Main St', 'City': 'New York', 'State': 'NY',
        'Zip': '10001', '国': 'US', '電話': '+1-555-0101', '国番号': '+1',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '配送先ID': 'SD-0002', '顧客ID': 'CT-0002', '宛名': 'Maria Garcia',
        'Address 1': '456 Calle Mayor', 'City': 'Madrid', 'State': 'Madrid',
        'Zip': '28001', '国': 'ES', '電話': '+34-555-0202', '国番号': '+34',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '配送先ID': 'SD-0003', '顧客ID': 'CT-0003', '宛名': 'James Wilson',
        'Address 1': '789 High Street', 'City': 'London', 'State': 'England',
        'Zip': 'SW1A 1AA', '国': 'GB', '電話': '+44-555-0303', '国番号': '+44',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '配送先ID': 'SD-0004', '顧客ID': 'CT-0004', '宛名': 'Sophie Martin',
        'Address 1': '12 Rue de Rivoli', 'City': 'Paris', 'State': 'Île-de-France',
        'Zip': '75001', '国': 'FR', '電話': '+33-555-0404', '国番号': '+33',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '配送先ID': 'SD-0005', '顧客ID': 'CT-0005', '宛名': 'Hiroshi Tanaka',
        'Address 1': '東京都渋谷区デモ通り1-1', 'City': 'Tokyo', 'State': 'Tokyo',
        'Zip': '150-0001', '国': 'JP', '電話': '+81-555-0505', '国番号': '+81',
        '既定': 'TRUE', '有効': 'TRUE'
      },
      {
        '配送先ID': 'SD-0006', '顧客ID': 'CT-0006', '宛名': 'Emma Davis',
        'Address 1': '321 George St', 'City': 'Sydney', 'State': 'NSW',
        'Zip': '2000', '国': 'AU', '電話': '+61-555-0606', '国番号': '+61',
        '既定': 'TRUE', '有効': 'TRUE'
      }
    ];
    writeDataRows(shippingDestSheet, shippingDestsData);

    // ── 5. PURCHASES（仕入れ）12 件 ──────────────────────────
    // STATUS の値を取得
    var purchaseConfirmedVal  = getCoreSchemaV1Value('PURCHASES', 'STATUS', 'CONFIRMED');
    var purchasePaidVal       = getCoreSchemaV1Value('PURCHASES', 'STATUS', 'PAID');
    var purchaseOrderedVal    = getCoreSchemaV1Value('PURCHASES', 'STATUS', 'ORDERED');
    var purchaseNotOrderedVal = getCoreSchemaV1Value('PURCHASES', 'STATUS', 'NOT_ORDERED');

    var purchasesSheet = getCoreSchemaV1Sheet(ss, 'PURCHASES');
    var purchasesData = [
      // ORD-0001 用: PAID → calculateOrderStatus で COMPLETED (発送と組み合わせ)
      {
        '仕入れID': 'PC-0001', 'オーダーID': 'ORD-0001', '注文日': D.jun05,
        '仕入元': 'Demo Supplier A', '数量': 3, '単価': 8000, '金額': 24000,
        'ステータス': purchasePaidVal, '登録日': D.jun05, '更新日': D.jun20
      },
      // ORD-0002 用: PAID
      {
        '仕入れID': 'PC-0002', 'オーダーID': 'ORD-0002', '注文日': D.jun10,
        '仕入元': 'Demo Supplier B', '数量': 2, '単価': 12000, '金額': 24000,
        'ステータス': purchasePaidVal, '登録日': D.jun10, '更新日': D.jun25
      },
      // ORD-0003 用: PAID → AWAITING_SHIPPING
      {
        '仕入れID': 'PC-0003', 'オーダーID': 'ORD-0003', '注文日': D.jun15,
        '仕入元': 'Demo Supplier A', '数量': 4, '単価': 6000, '金額': 24000,
        'ステータス': purchasePaidVal, '登録日': D.jun15, '更新日': D.jul10
      },
      // ORD-0003 用 2本目
      {
        '仕入れID': 'PC-0004', 'オーダーID': 'ORD-0003', '注文日': D.jun15,
        '仕入元': 'Demo Supplier C', '数量': 1, '単価': 9800, '金額': 9800,
        'ステータス': purchasePaidVal, '登録日': D.jun15, '更新日': D.jul10
      },
      // ORD-0004 用: PAID → AWAITING_SHIPPING
      {
        '仕入れID': 'PC-0005', 'オーダーID': 'ORD-0004', '注文日': D.jun20,
        '仕入元': 'Demo Supplier B', '数量': 5, '単価': 5500, '金額': 27500,
        'ステータス': purchasePaidVal, '登録日': D.jun20, '更新日': D.jul15
      },
      // ORD-0005 用: ORDERED (PAID でないので AWAITING_SHIPPING にならない)
      {
        '仕入れID': 'PC-0006', 'オーダーID': 'ORD-0005', '注文日': D.jul05,
        '仕入元': 'Demo Supplier A', '数量': 2, '単価': 15000, '金額': 30000,
        'ステータス': purchaseOrderedVal, '登録日': D.jul05, '更新日': D.jul05
      },
      // ORD-0005 用 2本目
      {
        '仕入れID': 'PC-0007', 'オーダーID': 'ORD-0005', '注文日': D.jul05,
        '仕入元': 'Demo Supplier D', '数量': 1, '単価': 18000, '金額': 18000,
        'ステータス': purchaseOrderedVal, '登録日': D.jul05, '更新日': D.jul05
      },
      // ORD-0006 用: ORDERED
      {
        '仕入れID': 'PC-0008', 'オーダーID': 'ORD-0006', '注文日': D.jul10,
        '仕入元': 'Demo Supplier B', '数量': 3, '単価': 10000, '金額': 30000,
        'ステータス': purchaseOrderedVal, '登録日': D.jul10, '更新日': D.jul10
      },
      // ORD-0007 用: NOT_ORDERED (支払い待ちのまま)
      {
        '仕入れID': 'PC-0009', 'オーダーID': 'ORD-0007', '注文日': '',
        '仕入元': 'Demo Supplier A', '数量': 2, '単価': 11000, '金額': 22000,
        'ステータス': purchaseNotOrderedVal, '登録日': D.jul20, '更新日': D.jul20
      },
      // ORD-0012 用: NOT_ORDERED 3件
      {
        '仕入れID': 'PC-0010', 'オーダーID': 'ORD-0012', '注文日': '',
        '仕入元': 'Demo Supplier C', '数量': 6, '単価': 5000, '金額': 30000,
        'ステータス': purchaseNotOrderedVal, '登録日': D.aug10, '更新日': D.aug10
      },
      {
        '仕入れID': 'PC-0011', 'オーダーID': 'ORD-0012', '注文日': '',
        '仕入元': 'Demo Supplier A', '数量': 2, '単価': 8000, '金額': 16000,
        'ステータス': purchaseNotOrderedVal, '登録日': D.aug10, '更新日': D.aug10
      },
      {
        '仕入れID': 'PC-0012', 'オーダーID': 'ORD-0012', '注文日': '',
        '仕入元': 'Demo Supplier B', '数量': 1, '単価': 12000, '金額': 12000,
        'ステータス': purchaseNotOrderedVal, '登録日': D.aug10, '更新日': D.aug10
      }
    ];
    writeDataRows(purchasesSheet, purchasesData);

    // ── 6. SHIPMENTS（発送）8 件 ──────────────────────────────
    var shipmentsSheet = getCoreSchemaV1Sheet(ss, 'SHIPMENTS');
    var shipmentsData = [
      // ORD-0001: 集荷依頼 + 運送状番号 → COMPLETED
      {
        '発送ID': 'SH-0001', 'オーダーID': 'ORD-0001', '箱番号': 1,
        '発送方法': 'FedEx', '発送日': D.jun20, '運送状番号': 'FX-DEMO-0001',
        '集荷依頼': 'TRUE', '通知': 'TRUE', '登録日': D.jun20, '更新日': D.jun20
      },
      // ORD-0001: 箱2 (集荷依頼なし → COMPLETED 判定には影響しない、SH-0001 が既に条件を満たす)
      {
        '発送ID': 'SH-0002', 'オーダーID': 'ORD-0001', '箱番号': 2,
        '発送方法': 'FedEx', '発送日': D.jun20, '運送状番号': 'FX-DEMO-0002',
        '集荷依頼': 'TRUE', '通知': 'TRUE', '登録日': D.jun20, '更新日': D.jun20
      },
      // ORD-0002: 集荷依頼 + 運送状番号 → COMPLETED
      {
        '発送ID': 'SH-0003', 'オーダーID': 'ORD-0002', '箱番号': 1,
        '発送方法': 'EMS', '発送日': D.jul01, '運送状番号': 'EMS-DEMO-0003',
        '集荷依頼': 'TRUE', '通知': 'TRUE', '登録日': D.jul01, '更新日': D.jul01
      },
      // ORD-0003: 集荷依頼なし・運送状番号なし → AWAITING_SHIPPING (purchase が PAID)
      {
        '発送ID': 'SH-0004', 'オーダーID': 'ORD-0003', '箱番号': 1,
        '発送方法': 'FedEx', '発送日': '', '運送状番号': '',
        '集荷依頼': '', '通知': '', '登録日': D.jul10, '更新日': D.jul10
      },
      // ORD-0004: 同様
      {
        '発送ID': 'SH-0005', 'オーダーID': 'ORD-0004', '箱番号': 1,
        '発送方法': 'FedEx', '発送日': '', '運送状番号': '',
        '集荷依頼': '', '通知': '', '登録日': D.jul15, '更新日': D.jul15
      },
      // ORD-0005: 集荷依頼なし → SOURCING
      {
        '発送ID': 'SH-0006', 'オーダーID': 'ORD-0005', '箱番号': 1,
        '発送方法': 'FedEx', '発送日': '', '運送状番号': '',
        '集荷依頼': '', '通知': '', '登録日': D.aug01, '更新日': D.aug01
      },
      // ORD-0006: 集荷依頼なし → SOURCING
      {
        '発送ID': 'SH-0007', 'オーダーID': 'ORD-0006', '箱番号': 1,
        '発送方法': 'EMS', '発送日': '', '運送状番号': '',
        '集荷依頼': '', '通知': '', '登録日': D.aug10, '更新日': D.aug10
      },
      // ORD-0012: 集荷依頼なし → AWAITING_PAYMENT (invoice あり、purchase NOT_ORDERED)
      {
        '発送ID': 'SH-0008', 'オーダーID': 'ORD-0012', '箱番号': 1,
        '発送方法': 'FedEx', '発送日': '', '運送状番号': '',
        '集荷依頼': '', '通知': '', '登録日': D.aug26, '更新日': D.aug26
      }
    ];
    writeDataRows(shipmentsSheet, shipmentsData);

    // ── 7. ORDERS（オーダー管理）12 件 ───────────────────────
    // STATUS / PAYMENT_STATUS をサービス関数で算出するため、
    // 先に purchases / shipments の参照オブジェクトを構築する。

    var purchasesByOrderId = {};
    purchasesData.forEach(function(p) {
      var oid = p['オーダーID'];
      if (!purchasesByOrderId[oid]) purchasesByOrderId[oid] = [];
      purchasesByOrderId[oid].push({ status: p['ステータス'] });
    });

    var shipmentsByOrderId = {};
    shipmentsData.forEach(function(s) {
      var oid = s['オーダーID'];
      if (!shipmentsByOrderId[oid]) shipmentsByOrderId[oid] = [];
      shipmentsByOrderId[oid].push({
        pickupRequest:  s['集荷依頼'],
        trackingNumber: s['運送状番号']
      });
    });

    // ORDER_ID 以外の各フィールドの仮データを定義する
    // STATUS / PAYMENT_STATUS はこのオブジェクトから calculateOrderStatus / calculatePaymentStatus で算出
    var orderDefs = [
      // ORD-0001: COMPLETED / PAID
      {
        id: 'ORD-0001', invoiceNumber: 'INV-2026-0001', customerId: 'CT-0001',
        shippingDestId: 'SD-0001', paymentDestId: 'PD-0001', sourceLeadId: 'LDI-0001',
        orderDate: D.jun01, currency: 'USD', exchangeRate: 150, lineTotal: 24000,
        shippingFee: 3500, duty: 0, invoiceTotal: 27500,
        paymentMethod: 'Wise', invoiceIssuedAt: D.jun02, paymentDueAt: D.jun30,
        paymentConfirmedAt: D.jul01, shippingMethod: 'FedEx',
        cancellationReason: '', registeredAt: D.jun01, updatedAt: D.aug26,
        invoiceIssuedAt_: D.jun02
      },
      // ORD-0002: COMPLETED / PAID
      {
        id: 'ORD-0002', invoiceNumber: 'INV-2026-0002', customerId: 'CT-0002',
        shippingDestId: 'SD-0002', paymentDestId: 'PD-0002', sourceLeadId: 'LDI-0002',
        orderDate: D.jun05, currency: 'EUR', exchangeRate: 163, lineTotal: 24000,
        shippingFee: 4200, duty: 0, invoiceTotal: 28200,
        paymentMethod: 'Wise', invoiceIssuedAt: D.jun06, paymentDueAt: D.jul05,
        paymentConfirmedAt: D.jul10, shippingMethod: 'EMS',
        cancellationReason: '', registeredAt: D.jun05, updatedAt: D.aug26,
        invoiceIssuedAt_: D.jun06
      },
      // ORD-0003: AWAITING_SHIPPING / PAID
      {
        id: 'ORD-0003', invoiceNumber: 'INV-2026-0003', customerId: 'CT-0003',
        shippingDestId: 'SD-0003', paymentDestId: 'PD-0003', sourceLeadId: 'LDI-0003',
        orderDate: D.jun10, currency: 'GBP', exchangeRate: 190, lineTotal: 33800,
        shippingFee: 5000, duty: 0, invoiceTotal: 38800,
        paymentMethod: 'PayPal', invoiceIssuedAt: D.jun11, paymentDueAt: D.jul10,
        paymentConfirmedAt: D.jul15, shippingMethod: 'FedEx',
        cancellationReason: '', registeredAt: D.jun10, updatedAt: D.aug26,
        invoiceIssuedAt_: D.jun11
      },
      // ORD-0004: AWAITING_SHIPPING / PAID
      {
        id: 'ORD-0004', invoiceNumber: 'INV-2026-0004', customerId: 'CT-0004',
        shippingDestId: 'SD-0004', paymentDestId: 'PD-0004', sourceLeadId: 'LDI-0004',
        orderDate: D.jun12, currency: 'EUR', exchangeRate: 163, lineTotal: 27500,
        shippingFee: 4800, duty: 0, invoiceTotal: 32300,
        paymentMethod: 'Wise', invoiceIssuedAt: D.jun13, paymentDueAt: D.jul12,
        paymentConfirmedAt: D.jul20, shippingMethod: 'FedEx',
        cancellationReason: '', registeredAt: D.jun12, updatedAt: D.aug26,
        invoiceIssuedAt_: D.jun13
      },
      // ORD-0005: SOURCING / PAID
      {
        id: 'ORD-0005', invoiceNumber: 'INV-2026-0005', customerId: 'CT-0005',
        shippingDestId: 'SD-0005', paymentDestId: 'PD-0005', sourceLeadId: 'LDI-0005',
        orderDate: D.jul01, currency: 'JPY', exchangeRate: 1, lineTotal: 48000,
        shippingFee: 6000, duty: 0, invoiceTotal: 54000,
        paymentMethod: 'Wise', invoiceIssuedAt: D.jul02, paymentDueAt: D.jul31,
        paymentConfirmedAt: D.aug01, shippingMethod: 'FedEx',
        cancellationReason: '', registeredAt: D.jul01, updatedAt: D.aug26,
        invoiceIssuedAt_: D.jul02
      },
      // ORD-0006: SOURCING / PAID
      {
        id: 'ORD-0006', invoiceNumber: 'INV-2026-0006', customerId: 'CT-0006',
        shippingDestId: 'SD-0006', paymentDestId: 'PD-0006', sourceLeadId: 'LDI-0006',
        orderDate: D.jul05, currency: 'AUD', exchangeRate: 98, lineTotal: 30000,
        shippingFee: 5500, duty: 0, invoiceTotal: 35500,
        paymentMethod: 'Wise', invoiceIssuedAt: D.jul06, paymentDueAt: D.aug05,
        paymentConfirmedAt: D.aug10, shippingMethod: 'EMS',
        cancellationReason: '', registeredAt: D.jul05, updatedAt: D.aug26,
        invoiceIssuedAt_: D.jul06
      },
      // ORD-0007: AWAITING_PAYMENT / UNPAID (paymentDueAt 未来)
      {
        id: 'ORD-0007', invoiceNumber: 'INV-2026-0007', customerId: 'CT-0001',
        shippingDestId: 'SD-0001', paymentDestId: 'PD-0001', sourceLeadId: 'LDI-0001',
        orderDate: D.jul15, currency: 'USD', exchangeRate: 150, lineTotal: 22000,
        shippingFee: 3500, duty: 0, invoiceTotal: 25500,
        paymentMethod: 'Wise', invoiceIssuedAt: D.jul16, paymentDueAt: D.sep15,
        paymentConfirmedAt: '', shippingMethod: 'FedEx',
        cancellationReason: '', registeredAt: D.jul15, updatedAt: D.aug26,
        invoiceIssuedAt_: D.jul16
      },
      // ORD-0008: AWAITING_PAYMENT / UNPAID (paymentDueAt 未来)
      {
        id: 'ORD-0008', invoiceNumber: 'INV-2026-0008', customerId: 'CT-0003',
        shippingDestId: 'SD-0003', paymentDestId: 'PD-0003', sourceLeadId: 'LDI-0003',
        orderDate: D.aug01, currency: 'GBP', exchangeRate: 190, lineTotal: 19000,
        shippingFee: 4200, duty: 0, invoiceTotal: 23200,
        paymentMethod: 'PayPal', invoiceIssuedAt: D.aug01, paymentDueAt: D.sep20,
        paymentConfirmedAt: '', shippingMethod: 'EMS',
        cancellationReason: '', registeredAt: D.aug01, updatedAt: D.aug26,
        invoiceIssuedAt_: D.aug01
      },
      // ORD-0009: CANCELLED / CANCELLED
      {
        id: 'ORD-0009', invoiceNumber: 'INV-2026-0009', customerId: 'CT-0002',
        shippingDestId: 'SD-0002', paymentDestId: 'PD-0002', sourceLeadId: 'LDI-0002',
        orderDate: D.may10, currency: 'EUR', exchangeRate: 163, lineTotal: 15000,
        shippingFee: 3000, duty: 0, invoiceTotal: 18000,
        paymentMethod: 'Wise', invoiceIssuedAt: D.may10, paymentDueAt: D.jun10,
        paymentConfirmedAt: '', shippingMethod: 'FedEx',
        cancellationReason: '顧客都合', registeredAt: D.may10, updatedAt: D.aug26,
        invoiceIssuedAt_: D.may10
      },
      // ORD-0010: CANCELLED / CANCELLED
      {
        id: 'ORD-0010', invoiceNumber: 'INV-2026-0010', customerId: 'CT-0004',
        shippingDestId: 'SD-0004', paymentDestId: 'PD-0004', sourceLeadId: 'LDI-0004',
        orderDate: D.may20, currency: 'EUR', exchangeRate: 163, lineTotal: 12000,
        shippingFee: 2800, duty: 0, invoiceTotal: 14800,
        paymentMethod: 'Wise', invoiceIssuedAt: D.may20, paymentDueAt: D.jun20,
        paymentConfirmedAt: '', shippingMethod: 'EMS',
        cancellationReason: '在庫なし', registeredAt: D.may20, updatedAt: D.aug26,
        invoiceIssuedAt_: D.may20
      },
      // ORD-0011: UNKNOWN / UNPAID (invoiceNumber なし、paymentConfirmedAt なし)
      {
        id: 'ORD-0011', invoiceNumber: '', customerId: 'CT-0005',
        shippingDestId: 'SD-0005', paymentDestId: 'PD-0005', sourceLeadId: 'LDI-0005',
        orderDate: D.aug10, currency: 'JPY', exchangeRate: 1, lineTotal: 0,
        shippingFee: 0, duty: 0, invoiceTotal: 0,
        paymentMethod: '', invoiceIssuedAt: '', paymentDueAt: '',
        paymentConfirmedAt: '', shippingMethod: '',
        cancellationReason: '', registeredAt: D.aug10, updatedAt: D.aug26,
        invoiceIssuedAt_: ''
      },
      // ORD-0012: AWAITING_PAYMENT / OVERDUE (paymentDueAt 過去)
      {
        id: 'ORD-0012', invoiceNumber: 'INV-2026-0012', customerId: 'CT-0006',
        shippingDestId: 'SD-0006', paymentDestId: 'PD-0006', sourceLeadId: 'LDI-0006',
        orderDate: D.jul20, currency: 'AUD', exchangeRate: 98, lineTotal: 58000,
        shippingFee: 7500, duty: 0, invoiceTotal: 65500,
        paymentMethod: 'Wise', invoiceIssuedAt: D.jul20, paymentDueAt: D.jul31,
        paymentConfirmedAt: '', shippingMethod: 'FedEx',
        cancellationReason: '', registeredAt: D.jul20, updatedAt: D.aug26,
        invoiceIssuedAt_: D.jul20
      }
    ];

    var ordersSheet = getCoreSchemaV1Sheet(ss, 'ORDERS');
    var ordersData = orderDefs.map(function(def) {
      var orderObj = {
        cancellationReason: def.cancellationReason,
        status:             '',   // TROUBLE 保持のため空（新規データなので TROUBLE なし）
        paymentConfirmedAt: def.paymentConfirmedAt,
        invoiceNumber:      def.invoiceNumber
      };
      var orderShipments = shipmentsByOrderId[def.id] || [];
      var orderPurchases = purchasesByOrderId[def.id] || [];

      var orderStatus  = calculateOrderStatus(orderObj, orderShipments, orderPurchases);
      var paymentStatusObj = {
        cancellationReason: def.cancellationReason,
        paymentConfirmedAt: def.paymentConfirmedAt,
        paymentDueAt:       def.paymentDueAt
      };
      var paymentStatus = calculatePaymentStatus(paymentStatusObj);

      return {
        'オーダーID':      def.id,
        '請求書番号':      def.invoiceNumber,
        '顧客ID':          def.customerId,
        '配送先ID':        def.shippingDestId,
        '支払先ID':        def.paymentDestId,
        '源流リードID':    def.sourceLeadId,
        'ステータス':      orderStatus,
        '受注日':          def.orderDate,
        '通貨':            def.currency,
        '為替レート':      def.exchangeRate,
        '明細合計':        def.lineTotal,
        '送料':            def.shippingFee,
        '関税':            def.duty,
        '請求総額':        def.invoiceTotal,
        '決済手段':        def.paymentMethod,
        '請求書発行日':    def.invoiceIssuedAt_,
        '支払期日':        def.paymentDueAt,
        '支払確認日':      def.paymentConfirmedAt,
        '発送方法':        def.shippingMethod,
        'キャンセル理由':  def.cancellationReason,
        '支払いステータス': paymentStatus,
        '登録日':          def.registeredAt,
        '更新日':          def.updatedAt
      };
    });
    writeDataRows(ordersSheet, ordersData);

    // ── 8. ORDER_LINES（オーダー明細）25 件 ──────────────────
    var orderLinesSheet = getCoreSchemaV1Sheet(ss, 'ORDER_LINES');
    var orderLinesData = [
      // ORD-0001: 3件
      { '明細ID': 'OL-0001', 'オーダーID': 'ORD-0001', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Alpha', '状態': '新品', '数量': 2, '単価': 7000, '小計': 14000 },
      { '明細ID': 'OL-0002', 'オーダーID': 'ORD-0001', '行番号': 2, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Elite Trainer Box', '状態': '新品', '数量': 1, '単価': 6000, '小計': 6000 },
      { '明細ID': 'OL-0003', 'オーダーID': 'ORD-0001', '行番号': 3, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Special Collection', '状態': '新品', '数量': 1, '単価': 4000, '小計': 4000 },
      // ORD-0002: 2件
      { '明細ID': 'OL-0004', 'オーダーID': 'ORD-0002', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Beta', '状態': '新品', '数量': 1, '単価': 12000, '小計': 12000 },
      { '明細ID': 'OL-0005', 'オーダーID': 'ORD-0002', '行番号': 2, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Promo Set', '状態': '新品', '数量': 1, '単価': 12000, '小計': 12000 },
      // ORD-0003: 3件
      { '明細ID': 'OL-0006', 'オーダーID': 'ORD-0003', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Gamma', '状態': '新品', '数量': 3, '単価': 6000, '小計': 18000 },
      { '明細ID': 'OL-0007', 'オーダーID': 'ORD-0003', '行番号': 2, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Case Set', '状態': '新品', '数量': 1, '単価': 9800, '小計': 9800 },
      { '明細ID': 'OL-0008', 'オーダーID': 'ORD-0003', '行番号': 3, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Mini Pack', '状態': '新品', '数量': 1, '単価': 6000, '小計': 6000 },
      // ORD-0004: 2件
      { '明細ID': 'OL-0009', 'オーダーID': 'ORD-0004', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Delta', '状態': '新品', '数量': 4, '単価': 5500, '小計': 22000 },
      { '明細ID': 'OL-0010', 'オーダーID': 'ORD-0004', '行番号': 2, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Tin Set', '状態': '新品', '数量': 1, '単価': 5500, '小計': 5500 },
      // ORD-0005: 2件
      { '明細ID': 'OL-0011', 'オーダーID': 'ORD-0005', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Premium Box', '状態': '新品', '数量': 2, '単価': 15000, '小計': 30000 },
      { '明細ID': 'OL-0012', 'オーダーID': 'ORD-0005', '行番号': 2, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Gift Box', '状態': '新品', '数量': 1, '単価': 18000, '小計': 18000 },
      // ORD-0006: 2件
      { '明細ID': 'OL-0013', 'オーダーID': 'ORD-0006', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Epsilon', '状態': '新品', '数量': 3, '単価': 10000, '小計': 30000 },
      { '明細ID': 'OL-0014', 'オーダーID': 'ORD-0006', '行番号': 2, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Promo Card', '状態': '新品', '数量': 0, '単価': 0, '小計': 0 },
      // ORD-0007: 2件
      { '明細ID': 'OL-0015', 'オーダーID': 'ORD-0007', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Zeta', '状態': '新品', '数量': 2, '単価': 11000, '小計': 22000 },
      { '明細ID': 'OL-0016', 'オーダーID': 'ORD-0007', '行番号': 2, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Elite Box', '状態': '新品', '数量': 0, '単価': 0, '小計': 0 },
      // ORD-0008: 1件
      { '明細ID': 'OL-0017', 'オーダーID': 'ORD-0008', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Eta', '状態': '新品', '数量': 1, '単価': 19000, '小計': 19000 },
      // ORD-0009: 1件
      { '明細ID': 'OL-0018', 'オーダーID': 'ORD-0009', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Theta', '状態': '新品', '数量': 1, '単価': 15000, '小計': 15000 },
      // ORD-0010: 1件
      { '明細ID': 'OL-0019', 'オーダーID': 'ORD-0010', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Booster Box Iota', '状態': '新品', '数量': 1, '単価': 12000, '小計': 12000 },
      // ORD-0011: 1件
      { '明細ID': 'OL-0020', 'オーダーID': 'ORD-0011', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Inquiry Box', '状態': '未定', '数量': 0, '単価': 0, '小計': 0 },
      // ORD-0012: 5件
      { '明細ID': 'OL-0021', 'オーダーID': 'ORD-0012', '行番号': 1, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Large Case A', '状態': '新品', '数量': 6, '単価': 5000, '小計': 30000 },
      { '明細ID': 'OL-0022', 'オーダーID': 'ORD-0012', '行番号': 2, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Large Case B', '状態': '新品', '数量': 2, '単価': 8000, '小計': 16000 },
      { '明細ID': 'OL-0023', 'オーダーID': 'ORD-0012', '行番号': 3, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Sealed Box Set', '状態': '新品', '数量': 1, '単価': 12000, '小計': 12000 },
      { '明細ID': 'OL-0024', 'オーダーID': 'ORD-0012', '行番号': 4, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Trainer Pack', '状態': '新品', '数量': 0, '単価': 0, '小計': 0 },
      { '明細ID': 'OL-0025', 'オーダーID': 'ORD-0012', '行番号': 5, 'カテゴリ': 'ポケモンカード', '商品名': 'Demo Premium Tin', '状態': '新品', '数量': 0, '単価': 0, '小計': 0 }
    ];
    writeDataRows(orderLinesSheet, orderLinesData);

    SpreadsheetApp.flush();

    // ── 投入結果サマリー ─────────────────────────────────────
    return {
      success: true,
      resultType: 'DEMO_SEED_COMPLETED_20260826',
      counts: {
        leads:            leadsData.length,
        customers:        customersData.length,
        paymentDests:     paymentDestsData.length,
        shippingDests:    shippingDestsData.length,
        orders:           ordersData.length,
        orderLines:       orderLinesData.length,
        purchases:        purchasesData.length,
        shipments:        shipmentsData.length
      },
      orderStatuses: ordersData.map(function(o) {
        return { id: o['オーダーID'], status: o['ステータス'], paymentStatus: o['支払いステータス'] };
      })
    };

  } finally {
    lock.releaseLock();
  }
}
