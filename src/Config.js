// ==========================================
// ⚙️ ERP システム設定 (Config.js)
// ==========================================
// NOTE: CRM側のCONFIGは 08_Config.js に定義されています

/**
 * 現在の環境を取得（'production' or 'development'）
 */
function getERPEnvironment() {
  return getEnvironment();
}

/**
 * 互換用: 旧ERPブックではなく、現在のDEVブックを返す。
 */
function getERPSpreadsheetId() {
  return getRequiredSpreadsheetProperty('DEV_SPREADSHEET_ID');
}

function getRequiredSpreadsheetProperty(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) throw new Error('プロパティ未設定: ' + key);
  return value;
}

function configureDevSpreadsheetProperties(devSpreadsheetId) {
  if (!devSpreadsheetId) throw new Error('プロパティ未設定: DEV_SPREADSHEET_ID');
  PropertiesService.getScriptProperties().setProperty('DEV_SPREADSHEET_ID', devSpreadsheetId);
  return { configured: ['DEV_SPREADSHEET_ID'] };
}

function smokeReadConfiguredSpreadsheets() {
  const dev = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('DEV_SPREADSHEET_ID'));
  return { devReadable: Boolean(dev.getId()) };
}

const ERP_CONFIG = {
  SPREADSHEET_ID: null,

  SHEETS: {
    CONFIG: { NAME: '⚙️設定', ID: 1159512127 },
    PRODUCT_MASTER: { NAME: 'M_商品', ID: 548021217 },
    CUSTOMER_MASTER: { NAME: 'M_顧客', ID: 884228295 },
    SUPPLIER_MASTER: { NAME: 'M_仕入先', ID: 580576840 },
    INVENTORY: { NAME: '📦在庫', ID: 2036676823 },
    VIEWER_SUPPLIER_STOCK: { NAME: '📦仕入在庫参照', ID: 1186337887 },
    INVOICE_INPUT: { NAME: '📝請求書作成', ID: 1761617187 },
    INVOICE_TEMPLATE: { NAME: 'フォーマット', ID: 74688869 },
    SALES_DATA: { NAME: '📊売上データ', ID: 600397303 },
    LEDGER: { NAME: '🗃️古物台帳', ID: 1079795576 },
    PURCHASE_LIST: { NAME: '📋仕入れリスト', ID: 1123262060 },
    RAW_FORM_RESPONSES: { NAME: 'raw_顧客回答', ID: 0 },

    // 配送・見積もり用
    SHIPPING_FEDEX: { NAME: 'FedEx_ShippingRates', ID: 264167304 },
    SHIPPING_DHL: { NAME: 'DHL_ShippingRates', ID: 1214726714 },
    SHIPPING_UPS: { NAME: 'UPS_ShippingRates', ID: 1195813452 },
    ZONES: { NAME: 'M_Zones', ID: 833993881 },

    // システム管理用
    SYSTEM_AGENTS: { NAME: '90_SystemAgents' },
    SYSTEM_SPECS: { NAME: '91_SystemSpecs' },
    SYSTEM_CHANGELOG: { NAME: '99_Changelog' }
  },

  DRIVE: {
    INVOICE_FOLDER_ID: ''  // 実行時に取得（clasp run対応）
  },

  API: {
    DISCORD_CRM_WEBHOOK: '',  // 実行時に取得（clasp run対応）
    GEMINI_API_KEY: ''  // 実行時に取得（clasp run対応）
  },

  HEADERS: {
    // 商品マスタ
    PRODUCT: {
      CATEGORY: 'Category',
      MARK: 'Mark',
      TITLE_JP: 'Japanese Title',
      TITLE_EN: 'English Title',
      BOXES_PER_CASE: 'Boxes per Case',
      PACKS_PER_BOX: 'Packs per Box',
      WEIGHT_BOX: 'Box重量',
      WEIGHT_CASE: 'Case重量',
      RELEASE_DATE: 'Release Date',
      KEYWORDS: 'Search Keywords',
      EXCLUDE: 'Exclude Keywords',
      RELATED: 'Related Series',
      CLASS: 'カテゴリ分類',
      OUTPUT_VAL: 'REQUIRED_OUTPUT_VALUE',
      MOQ: 'MOQz'
    },
    // 【追加】取引状況シート（SALES_DATA）の列名定義
    SALES_DATA: {
      DATE: '取引状況請求書発行日',
      NAME: '取引状況商品名',
      COND: '取引状況状態',
      QTY: '取引状況数量',
      PRICE: '取引状況単価'
    }
  }
};

/**
 * シート取得ヘルパー（ERP用）
 */
function getSheetByConfig(sheetConfig) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (sheetConfig.ID) {
    const target = ss.getSheets().find(s => s.getSheetId() === sheetConfig.ID);
    if (target) return target;
  }
  return ss.getSheetByName(sheetConfig.NAME);
}

/**
 * PropertiesServiceから値を取得（clasp run対応）
 */
function getERPProperty(key) {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(key) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Drive Folder IDを取得
 */
function getInvoiceFolderId() {
  return getERPProperty('INVOICE_FOLDER_ID');
}

/**
 * 発送書類ファイル保存先フォルダIDを取得
 */
function getShipmentFileFolderId() {
  return getERPProperty('SHIPMENT_FILE_FOLDER_ID');
}

/**
 * 発送書類ファイル保存先フォルダIDを Script Properties に登録する
 * clasp run setShipmentFileFolderProperty --params '["<folderId>"]' で呼び出す
 * @param {string} folderId
 */
function setShipmentFileFolderProperty(folderId) {
  PropertiesService.getScriptProperties().setProperty('SHIPMENT_FILE_FOLDER_ID', folderId);
  Logger.log('SHIPMENT_FILE_FOLDER_ID registered: ' + String(folderId).substring(0, 4) + '...');
}

/**
 * Discord Webhook URLを取得
 */
function getDiscordCRMWebhook() {
  return getERPProperty('DISCORD_CRM_WEBHOOK');
}

/**
 * Gemini API Keyを取得
 */
function getGeminiApiKey() {
  return getERPProperty('GEMINI_API_KEY');
}

/**
 * 現在の環境情報を表示
 */
function showERPEnvironment() {
  const env = getEnvironment();
  return {
    environment: env,
    devConfigured: Boolean(PropertiesService.getScriptProperties().getProperty('DEV_SPREADSHEET_ID'))
  };
}
