/**
 * DEV 環境専用: 支払先マスタ デモシード
 *
 * 関数: seedDemoPayments()
 *
 * 投入内容:
 *   - PY-90001 〜 PY-90100 の支払先を 100 件挿入する
 *   - 既存の 2行目以降を全削除してから挿入（べき等）
 *
 * ID 採番規則:
 *   PAYMENT_DESTINATION_ID : PY-9000n  (n=1〜100, ゼロ埋め5桁)
 *   CUSTOMER_ID            : CS-9000n
 *
 * ステータス分布 (n で決まる):
 *   支払先自体はステータスを持たないため分布なし
 *   COUNTRY      : n%3 === 0 → Japan / n%3 === 1 → USA / n%3 === 2 → Australia
 *   PAYMENT_METHOD: n%2 === 0 → Wise / n%2 === 1 → PayPal
 *   CURRENCY     : n%2 === 0 → JPY  / n%2 === 1 → USD
 *
 * 実行方法:
 *   clasp run seedDemoPayments  (POがまとめて実行)
 *
 * 戻り値:
 *   { success: true, resultType: 'DEMO_SEED_PAYMENTS_DONE', insertedCount: 100 }
 */
function seedDemoPayments() {
  // ── 環境ガード ──────────────────────────────────────────────────────────────
  if (getEnvironment() !== 'development') {
    throw new Error('seedDemoPayments は development 環境専用です');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = getSpreadsheet();
    var sheet = getCoreSchemaV1Sheet(ss, 'PAYMENT_DESTINATIONS');

    // ── ヘッダーを実測で取得 ────────────────────────────────────────────────
    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      throw new Error('支払先マスタ: ヘッダー行が空です');
    }
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    function colIdx(name) {
      var idx = headers.indexOf(name);
      if (idx === -1) throw new Error('支払先マスタ: ヘッダーが見つかりません: ' + name);
      return idx;
    }

    var idxPaymentDestinationId = colIdx('PAYMENT_DESTINATION_ID');
    var idxCustomerId           = colIdx('CUSTOMER_ID');
    var idxBillingName          = colIdx('BILLING_NAME');
    var idxAddressLine1         = colIdx('ADDRESS_LINE_1');
    var idxAddressLine2         = colIdx('ADDRESS_LINE_2');
    var idxAddressLine3         = colIdx('ADDRESS_LINE_3');
    var idxCity                 = colIdx('CITY');
    var idxState                = colIdx('STATE');
    var idxZip                  = colIdx('ZIP');
    var idxCountry              = colIdx('COUNTRY');
    var idxPaymentMethod        = colIdx('PAYMENT_METHOD');
    var idxCurrency             = colIdx('CURRENCY');
    var idxTaxId                = colIdx('TAX_ID');
    var idxDisplayName          = colIdx('DISPLAY_NAME');
    var idxIsDefault            = colIdx('IS_DEFAULT');
    var idxIsActive             = colIdx('IS_ACTIVE');

    // ── 2行目以降を全削除 ───────────────────────────────────────────────────
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.deleteRows(2, lastRow - 1);
    }

    // ── 100件のデモデータを構築 ─────────────────────────────────────────────
    var COUNTRIES = ['Japan', 'USA', 'Australia'];  // n%3 → 0:Japan, 1:USA, 2:Australia
    var rows = [];

    for (var n = 1; n <= 100; n++) {
      var paddedN   = ('00000' + n).slice(-5);      // 00001〜00100
      var nameLabel = ('000' + n).slice(-3);         // 001〜100 (顧客名用)

      var country        = COUNTRIES[n % 3];
      var paymentMethod  = (n % 2 === 0) ? 'Wise' : 'PayPal';
      var currency       = (n % 2 === 0) ? 'JPY'  : 'USD';
      var billingName    = 'デモ商事 ' + nameLabel;

      var row = new Array(lastCol);
      for (var c = 0; c < row.length; c++) { row[c] = ''; }

      row[idxPaymentDestinationId] = 'PY-9' + paddedN;
      row[idxCustomerId]           = 'CS-9' + paddedN;
      row[idxBillingName]          = billingName;
      row[idxAddressLine1]         = 'デモ市デモ町 1-1-1';
      row[idxAddressLine2]         = '';
      row[idxAddressLine3]         = '';
      row[idxCity]                 = 'デモ市';
      row[idxState]                = '';
      row[idxZip]                  = '000-0000';
      row[idxCountry]              = country;
      row[idxPaymentMethod]        = paymentMethod;
      row[idxCurrency]             = currency;
      row[idxTaxId]                = '';
      row[idxDisplayName]          = billingName;
      row[idxIsDefault]            = true;
      row[idxIsActive]             = true;

      rows.push(row);
    }

    // ── 一括挿入 ────────────────────────────────────────────────────────────
    sheet.getRange(2, 1, rows.length, lastCol).setValues(rows);

    return {
      success:       true,
      resultType:    'DEMO_SEED_PAYMENTS_DONE',
      insertedCount: rows.length
    };

  } finally {
    lock.releaseLock();
  }
}
