/**
 * doGet関数は gas/27_WebApp.js に統合されました
 * このファイルの doGet() は無効化されました（重複防止）
 *
 * メインの doGet() は gas/27_WebApp.js を参照してください
 */
function doGet_ERP_DISABLED() {
  const payload = getInitialAppPayload();
  const template = HtmlService.createTemplateFromFile('index');
  template.initialPayload = JSON.stringify(payload);

  return template.evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0')
    .setTitle('Cloud ERP System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * アプリ起動時に必要な全データを一括取得
 */
function getInitialAppPayload() {
  const stock = getStockData();
  const countries = getCountryList();
  const customerMaster = getCustomerListForUI();

  return {
    stock: stock,
    quotation: {
      countries: countries
    },
    crm: {
      customers: customerMaster
    },
    user: resolveCurrentUserEmail()
  };
}

/**
 * UI用に軽量化した顧客リストを取得
 */
function getCustomerListForUI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets().find(s => s.getSheetId().toString() === CONFIG.SHEETS.CUSTOMER_MASTER.ID.toString());
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  // ヘッダー: [顧客ID, Timestamp, Billing Name, Email, ...]
  return data.slice(1).map(r => ({
    id: r[0],
    name: r[2],
    email: r[3]
  })).filter(c => c.name);
}

// HTMLを読み込むための魔法の関数
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 各ページのHTMLパーツを取得する（ルーティング用）
 */
function getPartHtml(partName) {
  return include(partName);
}