/**
 * 発行元マスタ のシート作成と初期データ投入
 *
 * setupIssuerMasterSheet()
 *   - 既存タブがあれば何もしない（ALREADY_EXISTS を返す）
 *   - ヘッダーは Core Schema V1 の定義から生成（物理ヘッダー名の直書きなし）
 *   - LockService で保護
 *
 * seedIssuerMaster()
 *   - データが既に1行以上あれば何もしない
 *   - HIGH LIFE JAPAN の1行を投入（住所分離型 18列構造）
 *   - LockService で保護
 *
 * buildAddressLines(addr)
 *   - 住所オブジェクトから印刷用住所行を組み立てる共通関数
 *   - 配送先マスタ・支払先マスタ・発行元マスタで共通利用可能
 *
 * ★ 実行は配布後に指示を待つこと
 */

function setupIssuerMasterSheet() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss        = getSpreadsheet();
    var tableKey  = 'ISSUER';
    var table     = getCoreSchemaV1Table(tableKey);
    var sheetName = table.sheetName;

    if (ss.getSheetByName(sheetName)) {
      Logger.log('[setupIssuerMasterSheet] ' + sheetName + ' は既に存在します。何もしません。');
      return { status: 'ALREADY_EXISTS', sheetName: sheetName };
    }

    var headerNames = Object.values(table.headers);

    var sheet = ss.insertSheet(sheetName);
    sheet.getRange(table.headerRowNumber, 1, 1, headerNames.length).setValues([headerNames]);
    sheet.getRange(table.headerRowNumber, 1, 1, headerNames.length)
      .setFontWeight('bold')
      .setBackground('#1565C0')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    Logger.log('[setupIssuerMasterSheet] 作成完了: ' + sheetName + ' (' + headerNames.length + '列)');
    return { status: 'CREATED', sheetName: sheetName, columns: headerNames.length };
  } finally {
    lock.releaseLock();
  }
}

function seedIssuerMaster() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss       = getSpreadsheet();
    var tableKey = 'ISSUER';
    var table    = getCoreSchemaV1Table(tableKey);
    var sheetName = table.sheetName;

    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('CORE_SCHEMA_REQUIRED_TAB_MISSING: 発行元マスタ — setupIssuerMasterSheet() を先に実行してください');
    }

    var dataRowCount = sheet.getLastRow() - table.headerRowNumber;
    if (dataRowCount > 0) {
      Logger.log('[seedIssuerMaster] データが既に存在します（' + dataRowCount + '行）。何もしません。');
      return { status: 'ALREADY_SEEDED', rows: dataRowCount };
    }

    var lastCol    = sheet.getLastColumn();
    var rawHeaders = lastCol > 0
      ? sheet.getRange(table.headerRowNumber, 1, 1, lastCol).getValues()[0]
      : [];

    function colOf(headerKey) {
      var name = getCoreSchemaV1HeaderName(tableKey, headerKey);
      var idx  = rawHeaders.indexOf(name);
      if (idx === -1) throw new Error('HEADER_NOT_FOUND:' + headerKey);
      return idx + 1; // 1-based
    }

    var colIssuerId       = colOf('ISSUER_ID');
    var colCompanyName    = colOf('COMPANY_NAME');
    var colContactName    = colOf('CONTACT_NAME');
    var colAddressLine1   = colOf('ADDRESS_LINE1');
    var colAddressLine2   = colOf('ADDRESS_LINE2');
    var colAddressLine3   = colOf('ADDRESS_LINE3');
    var colCity           = colOf('CITY');
    var colState          = colOf('STATE');
    var colZip            = colOf('ZIP');
    var colCountry        = colOf('COUNTRY');
    var colPhone          = colOf('PHONE');
    var colEmail          = colOf('EMAIL');
    var colRegistrationNo = colOf('REGISTRATION_NO');
    var colPayeeName      = colOf('PAYEE_NAME');
    var colPaymentEmail   = colOf('PAYMENT_EMAIL');
    var colPaymentNote    = colOf('PAYMENT_NOTE');
    var colClosingMessage = colOf('CLOSING_MESSAGE');
    var colIsActive       = colOf('IS_ACTIVE');

    var startRow = table.headerRowNumber + 1;

    sheet.getRange(startRow, colIssuerId).setValue('ISS-00001');
    sheet.getRange(startRow, colCompanyName).setValue('HIGH LIFE JAPAN');
    sheet.getRange(startRow, colContactName).setValue('Shingo Tanizawa');
    sheet.getRange(startRow, colAddressLine1).setValue('2F, Nishishinjuku Mizuma Building');
    sheet.getRange(startRow, colAddressLine2).setValue('3-3-13 Nishishinjuku');
    sheet.getRange(startRow, colAddressLine3).setValue('');
    sheet.getRange(startRow, colCity).setValue('Shinjuku-ku');
    sheet.getRange(startRow, colState).setValue('Tokyo');
    sheet.getRange(startRow, colZip).setValue('1600023');
    sheet.getRange(startRow, colCountry).setValue('Japan');
    sheet.getRange(startRow, colPhone).setValue('+81 9060727767');
    sheet.getRange(startRow, colEmail).setValue('payment@treasureislandjp.com');
    sheet.getRange(startRow, colRegistrationNo).setValue('T3810449547408');
    sheet.getRange(startRow, colPayeeName).setValue('Hitoshi Morimoto');
    sheet.getRange(startRow, colPaymentEmail).setValue('Payment@treasureislandjp.com');
    sheet.getRange(startRow, colPaymentNote).setValue('Our Wise account is registered under the name Hitoshi Morimoto, who is responsible for financial and billing operations within our company. This is the official and authorized payment account for all transactions of Treasure Island Japan / HIGH LIFE JAPAN.');
    sheet.getRange(startRow, colClosingMessage).setValue('Thank you for your business!');
    sheet.getRange(startRow, colIsActive).setValue(true);

    Logger.log('[seedIssuerMaster] 投入完了: 1件');
    return { status: 'SEEDED', rows: 1 };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 住所オブジェクトから印刷用住所行を組み立てる
 * 配送先マスタ・支払先マスタ・発行元マスタで共通利用可能
 *
 * @param {Object} addr - 住所フィールドを含むオブジェクト
 *   addr.line1, addr.line2, addr.line3, addr.city, addr.state, addr.zip, addr.country
 * @returns {string[]} 空でない行の配列（最大2要素）
 *   [0] "line1, line2, line3"（空欄省略・カンマ区切り）
 *   [1] "city, state, country zip"（空欄省略）
 *
 * 例（発行元）:
 *   line1="2F, Nishishinjuku Mizuma Building", line2="3-3-13 Nishishinjuku",
 *   line3="", city="Shinjuku-ku", state="Tokyo", zip="1600023", country="Japan"
 *   → ["2F, Nishishinjuku Mizuma Building, 3-3-13 Nishishinjuku",
 *       "Shinjuku-ku, Tokyo, Japan 1600023"]
 */
function buildAddressLines(addr) {
  var streetParts = [addr.line1, addr.line2, addr.line3].filter(function(v) {
    return v && String(v).trim() !== '';
  });
  var line1 = streetParts.join(', ');

  var cityStateParts = [addr.city, addr.state, addr.country].filter(function(v) {
    return v && String(v).trim() !== '';
  });
  var line2 = cityStateParts.join(', ');
  if (addr.zip && String(addr.zip).trim() !== '') {
    line2 = line2 + ' ' + String(addr.zip).trim();
  }

  return [line1, line2].filter(function(v) { return v !== ''; });
}
