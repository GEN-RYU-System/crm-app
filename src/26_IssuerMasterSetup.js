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
 *   - HIGH LIFE JAPAN の1行を投入
 *   - LockService で保護
 *
 * ★ 実行は配布後に指示を待つこと
 */

function setupIssuerMasterSheet() {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
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
  lock.waitLock(5000);
  try {
    var ss       = getSpreadsheet();
    var tableKey = 'ISSUER';
    var table    = getCoreSchemaV1Table(tableKey);
    var sheetName = table.sheetName;

    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log('[seedIssuerMaster] シートが存在しないため先に setupIssuerMasterSheet を呼びます。');
      setupIssuerMasterSheet();
      sheet = ss.getSheetByName(sheetName);
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
    sheet.getRange(startRow, colAddressLine1).setValue('2F, Nishishinjuku Mizuma Building, 3-3-13 Nishishinjuku');
    sheet.getRange(startRow, colAddressLine2).setValue('Shinjuku-ku, Tokyo, Japan 1600023');
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
