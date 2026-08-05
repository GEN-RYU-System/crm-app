// ==========================================
// ⚙️ ERP システム設定 (Config.js)
// ==========================================
// NOTE: CRM側のCONFIGは 08_Config.js に定義されています

/**
 * 現在の環境を取得（'production' or 'development'）
 */
function getERPEnvironment() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('ENVIRONMENT') || 'production';
  } catch (e) {
    return 'production';
  }
}

/**
 * 環境に応じたスプレッドシートIDを取得
 */
function getERPSpreadsheetId() {
  const env = getERPEnvironment();

  if (env === 'development') {
    // テスト環境: Script Propertiesから取得
    try {
      const props = PropertiesService.getScriptProperties();
      const devId = props.getProperty('DEV_SPREADSHEET_ID');
      if (devId) {
        Logger.log('テスト環境を使用: ' + devId);
        return devId;
      }
    } catch (e) {
      Logger.log('DEV_SPREADSHEET_ID取得エラー: ' + e.message);
    }
  }

  // 本番環境: 固定ID
  return '1kF-o4jCrbQePktWaFEBvWhJJjRXhkuw5-AcISa4ClAk';
}

const ERP_CONFIG = {
  SPREADSHEET_ID: getERPSpreadsheetId(),  // 環境切り替え対応

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

// ============================================================
// 環境設定（テスト/本番切り替え）
// ============================================================

/**
 * テスト環境を設定
 * GASエディタから実行してテスト環境に切り替える
 */
function setupERPTestEnvironment() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ENVIRONMENT', 'development');
  props.setProperty('DEV_SPREADSHEET_ID', '1G4ffyH8Abiki0861CjRvGiO_Ks_8wMiZKaWfujcOzvs');

  Logger.log('========================================');
  Logger.log('テスト環境を設定しました');
  Logger.log('環境: development');
  Logger.log('スプレッドシートID: 1G4ffyH8Abiki0861CjRvGiO_Ks_8wMiZKaWfujcOzvs');
  Logger.log('========================================');

  return {
    success: true,
    environment: 'development',
    spreadsheetId: '1G4ffyH8Abiki0861CjRvGiO_Ks_8wMiZKaWfujcOzvs'
  };
}

/**
 * 本番環境を設定
 * GASエディタから実行して本番環境に切り替える
 */
function setupERPProductionEnvironment() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ENVIRONMENT', 'production');

  Logger.log('========================================');
  Logger.log('本番環境を設定しました');
  Logger.log('環境: production');
  Logger.log('スプレッドシートID: 1kF-o4jCrbQePktWaFEBvWhJJjRXhkuw5-AcISa4ClAk');
  Logger.log('========================================');

  return {
    success: true,
    environment: 'production',
    spreadsheetId: '1kF-o4jCrbQePktWaFEBvWhJJjRXhkuw5-AcISa4ClAk'
  };
}

/**
 * 現在の環境情報を表示
 */
function showERPEnvironment() {
  const env = getERPEnvironment();
  const spreadsheetId = getERPSpreadsheetId();

  Logger.log('========================================');
  Logger.log('現在の環境情報（ERP）');
  Logger.log('========================================');
  Logger.log('環境: ' + env);
  Logger.log('スプレッドシートID: ' + spreadsheetId);

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    Logger.log('スプレッドシート名: ' + ss.getName());
  } catch (e) {
    Logger.log('スプレッドシート取得エラー: ' + e.message);
  }

  Logger.log('========================================');

  return {
    environment: env,
    spreadsheetId: spreadsheetId
  };
}