/**
 * CRM設定・定数
 */

// ============================================================
// 環境設定（本番/開発切り替え）
// ============================================================

/**
 * 本番環境の固定ID
 */
const PRODUCTION_IDS = {
  SPREADSHEET_ID: '1kF-o4jCrbQePktWaFEBvWhJJjRXhkuw5-AcISa4ClAk',
  ARCHIVE_BOOK_ID: '1J4VFKwwV5xbEy15TrbwriFRDiYTH-YfrVTzwTQJpXpI',
  DEV_FOLDER_ID: '1BKFjFJIxEM2j-HFaxgFuTLAcgAnRuXMi',
  // SCM（サプライチェーン管理）スプレッドシート
  SCM_SPREADSHEET_ID: '1IvM1lBvPRPJRaMLODHYgWwDJzu1j038hYQxrk6ipZPs'
};

/**
 * デプロイID
 */
const DEPLOY_IDS = {
  PRODUCTION: 'AKfycbzpeOkyBzA0kyD6T9aDE1uYVIil1z6KY0Ssc6Hta5EX7xoIAk_-EkxgmjILhN9Ceg5M',
  TEST: 'AKfycbwGUUcdUs_L-a4c9Ux9PBPuX9X6t5YMGVnlInL5RGOq63a2QfaJUgIbNdV4ylcN0Xou2g'
};

/**
 * 現在の環境を取得（'production' or 'development'）
 */
function getEnvironment() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('ENVIRONMENT') || 'production';
}

/**
 * 環境を設定
 * @param {string} env - 'production' or 'development'
 */
function setEnvironment(env) {
  if (env !== 'production' && env !== 'development') {
    throw new Error('環境は "production" または "development" を指定してください');
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ENVIRONMENT', env);
  Logger.log('環境を ' + env + ' に設定しました');
}

/**
 * スプレッドシートを取得（環境に応じて切り替え）
 */
function getSpreadsheet() {
  const env = getEnvironment();
  const props = PropertiesService.getScriptProperties();

  if (env === 'development') {
    const devId = props.getProperty('DEV_SPREADSHEET_ID');
    if (!devId) {
      Logger.log('警告: DEV_SPREADSHEET_ID が未設定のため、本番スプレッドシートを使用します');
      return SpreadsheetApp.openById(PRODUCTION_IDS.SPREADSHEET_ID);
    }
    return SpreadsheetApp.openById(devId);
  }

  // 本番環境
  return SpreadsheetApp.openById(PRODUCTION_IDS.SPREADSHEET_ID);
}

/**
 * アーカイブブックを取得（環境に応じて切り替え）
 */
function getArchiveBook() {
  const env = getEnvironment();
  const props = PropertiesService.getScriptProperties();

  if (env === 'development') {
    const devArchiveId = props.getProperty('DEV_ARCHIVE_BOOK_ID');
    if (devArchiveId) {
      return SpreadsheetApp.openById(devArchiveId);
    }
    // 開発環境でもアーカイブブックがない場合は本番を使用（読み取り専用想定）
    Logger.log('警告: DEV_ARCHIVE_BOOK_ID が未設定のため、本番アーカイブブックを使用します');
  }

  return SpreadsheetApp.openById(PRODUCTION_IDS.ARCHIVE_BOOK_ID);
}

/**
 * 現在の環境情報を表示（デバッグ用）
 */
function showCurrentEnvironment() {
  const env = getEnvironment();
  const props = PropertiesService.getScriptProperties();

  Logger.log('========================================');
  Logger.log('現在の環境情報');
  Logger.log('========================================');
  Logger.log('ENVIRONMENT: ' + env);

  try {
    const ss = getSpreadsheet();
    Logger.log('スプレッドシート: ' + ss.getName());
    Logger.log('スプレッドシートID: ' + ss.getId());
  } catch (e) {
    Logger.log('スプレッドシート取得エラー: ' + e.message);
  }

  if (env === 'development') {
    Logger.log('DEV_SPREADSHEET_ID: ' + (props.getProperty('DEV_SPREADSHEET_ID') || '未設定'));
    Logger.log('DEV_ARCHIVE_BOOK_ID: ' + (props.getProperty('DEV_ARCHIVE_BOOK_ID') || '未設定'));
  }

  Logger.log('========================================');

  return {
    environment: env,
    spreadsheetId: getSpreadsheet().getId(),
    spreadsheetName: getSpreadsheet().getName()
  };
}

const CONFIG = {
  // シート名
  SHEETS: {
    // 統合リード管理シート（メイン）
    LEADS: 'リード管理',

    // マスタ・設定シート
    STAFF: '担当者マスタ',
    SETTINGS: '選択肢マスタ',
    PERMISSIONS: '権限設定',
    GOALS: '目標設定',
    TEMPLATES: 'テンプレート',

    // レポート・シフトシート
    WEEKLY_REPORT: '週次レポート',
    MONTHLY_REPORT: '月次レポート',
    SHIFT: 'シフト',

    // ログシート
    BUDDY_LOG: 'Buddy対話ログ',

    // 会話ログシート（統合）
    CONVERSATION_LOG: '会話ログ',
    TERM_DICTIONARY: '専門用語辞書',

    // お知らせシート
    NOTICES: 'お知らせ',
    READ_STATUS: '既読管理',

    // FAQシート
    FAQ: 'FAQ',

    // ★ ERP統合: 見積・請求書管理 ★
    QUOTES: '見積書管理',
    QUOTE_ITEMS: '見積書明細',
    INVOICES: '請求書管理',
    INVOICE_ITEMS: '請求書明細',
    INVOICE_INPUT: '📝請求書作成',
    INVOICE_TEMPLATE: 'フォーマット',
    SALES_DATA: '📊売上データ',

    // ★ ERP統合: マスタデータ（IMPORTRANGE同期） ★
    CUSTOMER_MASTER: 'M_Customer',
    PRODUCT_MASTER_SYNC: 'M_Product同期',
    STOCK_LIST_SYNC: 'Stock List同期',
    ZONES_SYNC: 'M_Zones同期',
    FEDEX_RATES_SYNC: 'FedEx_ShippingRates同期',
    DHL_RATES_SYNC: 'DHL_ShippingRates同期',
    UPS_RATES_SYNC: 'UPS_ShippingRates同期',
    SALES_DATA_SYNC: '📊売上データ同期',

    // ★ SCM統合: マスタデータ（IMPORTRANGE同期） ★
    SCM_PRODUCT_MASTER_SYNC: '商品マスタ同期',
    SCM_STOCK_SYNC: '集計同期',
    SCM_SUPPLIER_MASTER_SYNC: '仕入元マスタ同期',

    // ★ CRM顧客マスタ（CRM内ネイティブ） ★
    CRM_CUSTOMERS: '顧客マスタ',
    CRM_SHIPPING: '配送先マスタ',
    CRM_PAYMENT: '支払先マスタ',

    // ★ オーダー管理 ★
    ORDER_MASTER: 'オーダー管理',
    ORDER_LINES: 'オーダー明細'
  },

  // リードID接頭辞（インバウンド: LDI-, アウトバウンド: LDO-）
  LEAD_ID_PREFIX_IN: 'LDI-',
  LEAD_ID_PREFIX_OUT: 'LDO-',

  // 担当者ID接頭辞
  STAFF_ID_PREFIX: 'EMP-',

  // リマインド閾値（時間）
  REMIND_THRESHOLD_HOURS: 48,

  // 進捗ステータス（設定シート参照が基本、これはフォールバック）
  PROGRESS_STATUSES: {
    // リード段階（CS）
    NEW: '新規',
    IN_PROGRESS: '対応中',
    NOT_APPLICABLE_LEAD: '対象外',
    // 商談段階（営業）
    ASSIGNED: 'アサイン確定',
    DEALING: '商談中',
    ESTIMATE: '見積もり提示',
    // 完了段階
    WON: '成約',
    LOST: '失注',
    FOLLOW_UP: '追客',
    NOT_APPLICABLE: '対象外',
    ARCHIVED: 'アーカイブ'
  },

  // リード種別
  LEAD_TYPES: {
    INBOUND: 'インバウンド',
    OUTBOUND: 'アウトバウンド'
  },

  // リード段階のステータス（リマインド対象外）
  LEAD_STATUSES: ['新規', '対応中', '対象外'],

  // 商談段階のステータス（リマインド対象）
  DEAL_STATUSES: ['アサイン確定', '商談中', '見積もり提示'],

  // 完了ステータス（アーカイブ対象）
  CLOSED_STATUSES: ['成約', '失注', '追客', '対象外', 'アーカイブ'],

  // ボトルネック特定設定
  BOTTLENECK_SETTINGS: {
    STAGNATION_HOURS: 48,           // 停滞判定（時間）- 商談メモ未更新
    LONG_DEAL_DAYS: 7,              // クロージング長期化判定（日）
    CONVERSION_DROP_THRESHOLD: 20,  // 成約率低下閾値（%）
    STAGNATION_WARNING_COUNT: 3     // 要介入判定の停滞件数
  },

  // ============================================================
  // ★ ERP統合: 見積・請求書機能 ★
  // ============================================================

  // 見積書ステータス
  QUOTE_STATUS: {
    DRAFT: '下書き',
    SENT: '送付済み',
    APPROVED: '承認済み',
    REJECTED: '却下',
    EXPIRED: '期限切れ'
  },

  // 請求書ステータス
  INVOICE_STATUS: {
    DRAFT: '下書き',
    SENT: '送付済み',
    PAID: '入金済み',
    PARTIALLY_PAID: '部分入金',
    OVERDUE: '期限超過',
    CANCELLED: 'キャンセル'
  },

  // 決済方法
  PAYMENT_METHODS: {
    BANK_TRANSFER: '銀行振込',
    PAYPAL: 'PayPal',
    WISE: 'Wise',
    CREDIT_CARD: 'クレジットカード',
    OTHER: 'その他'
  },

  // 通貨
  CURRENCIES: {
    JPY: '日本円（JPY）',
    USD: '米ドル（USD）',
    EUR: 'ユーロ（EUR）'
  },

  // ERP連携設定
  ERP: {
    // ERPスプレッドシートID（PropertiesServiceから取得、フォールバック）
    SPREADSHEET_ID: '1_ThEcJWBUUiLOTkiJ2wavoNkVMUk1Mu1AUh9zz-9LZY',

    // ERPシート名（同期先）
    SHEETS: {
      SALES_DATA: '📊売上データ',
      STOCK_LIST: 'Stock List',
      PRODUCT_MASTER: 'M_Product',
      PURCHASE_LIST: '📋仕入れリスト'
    }
  }
};

/**
 * プルダウン選択肢（デフォルト値・初期設定用）
 * 基本的には設定シートを参照するが、設定シートがない場合のフォールバック
 */
const DEFAULT_DROPDOWN_OPTIONS = {
  '流入経路（IN）': [],
  '流入経路（OUT）': [],
  国: ['USA', 'Canada', 'UK', 'Germany', 'France', 'Australia', 'Philippines', 'Thailand', 'Malaysia', 'Singapore', 'Indonesia', 'Hong Kong', 'Taiwan', 'Korea', 'China', 'その他'],
  温度感: ['高', '中', '低'],
  想定規模: ['大口', '中規模', '小口', '不明'],
  顧客タイプ: ['信頼重視', '価格重視', '不明'],
  返信速度: ['24h以内', '48h以内', '3日以上', '未返信'],
  連絡手段: ['Instagram DM', 'WhatsApp', 'Email', 'Discord', 'LINE', '電話', 'その他'],
  進捗ステータス: ['新規', '対応中', '対象外', 'アサイン確定', '商談中', '見積もり提示', '成約', '失注', '追客', 'アーカイブ'],
  次回アクション日: ['相手の返信後', '不明点を確認後', '本日中', '明日までに', '3日以内', '1週間以内'],
  取り扱いタイトル: ['Pokemon', 'One Piece', 'Yu-Gi-Oh', 'Dragon Ball', 'Weiss Schwarz', '複数', 'その他'],
  販売形態: ['実店舗', 'EC', 'ライブ配信', '複合', '不明'],
  競合比較中: ['はい', 'いいえ', '不明'],
  購入頻度: ['週1回以上', '月2-3回', '月1回', '不定期'],
  商談結果: ['成約', '失注', '追客', '対象外'],
  商談の手応え: ['◎ 非常に良い', '○ 良い', '△ 普通', '× 厳しい'],
  アーカイブ理由: ['連絡不通', '対象外', '重複', 'その他'],
  対象外理由: ['予算不足', 'ニーズ不一致', '地域対象外', 'その他'],
  失注理由: ['競合負け', '価格不一致', 'タイミング合わず', '予算凍結', 'その他'],
  役割: ['オーナー', 'システム管理者', 'リーダー', '営業', 'CS'],
  ステータス: ['有効', '無効'],
  期間タイプ: ['月次', '週次', '四半期', '年次']
};

/**
 * プルダウン項目名（設定シートのヘッダー順）
 */
const DROPDOWN_COLUMNS = [
  '流入経路（IN）', '流入経路（OUT）', '国', '温度感', '想定規模', '顧客タイプ', '返信速度', '連絡手段',
  '進捗ステータス', '次回アクション日', '取り扱いタイトル', '販売形態', '競合比較中', '購入頻度',
  '商談結果', '商談の手応え', 'アーカイブ理由', '対象外理由', '失注理由', '役割', 'ステータス', '期間タイプ'
];

/**
 * ヘッダー定義（統合リード管理シート：60列）
 * SetupIntegratedSheet.gs の LEAD_SHEET_HEADERS と同期必須
 * CLAUDE.md Section 2.2 準拠
 */
const HEADERS = {
  // 統合リード管理シート（61列・2026-08-06実測値に同期）
  LEADS: [
    'リードID',           // 1
    '登録日',             // 2
    '顧客名',             // 3
    'リード進捗',         // 4
    '商談進捗',           // 5
    '商談結果',           // 6
    '呼び方（英語）',     // 7
    '国',                 // 8
    'シート更新日',       // 9
    'リード担当者',       // 10
    'リード種別',         // 11
    '流入経路',           // 12
    'メッセージURL',      // 13
    '取り扱いタイトル',   // 14
    'CSメモ',             // 15
    'メール',             // 16
    '電話番号',           // 17
    '連絡手段',           // 18
    '温度感',             // 19
    '想定規模',           // 20
    '返信速度',           // 21
    '問い合わせ回数',     // 22
    'アーカイブ日',       // 23
    'アーカイブ理由',     // 24
    'アサイン日',         // 25
    '営業担当者',         // 26
    '担当者ID',           // 27
    '顧客タイプ',         // 28
    '最終対応者ID',       // 29
    '見込度',             // 30
    '次回アクション',     // 31
    '次回アクション日',   // 32
    '商談メモ',           // 33
    '相手の課題',         // 34
    '販売形態',           // 35
    '月間見込み金額',     // 36
    '1回の発注金額',      // 37
    '購入頻度(月次)',     // 38
    '競合比較中',         // 39
    '商談の手応え',       // 40
    'アラート確認日',     // 41
    '対象外理由',         // 42
    '失注理由',           // 43
    '初回取引日',         // 44
    '初回取引金額',       // 45
    '累計取引金額',       // 46
    'Good Point',         // 47
    'More Point',         // 48
    '反省と今後の抱負',   // 49
    'レポート提出日',     // 50
    'レポート確認者',     // 51
    'レポート確認日',     // 52
    'レポートコメント',   // 53
    'Buddyフィードバック', // 54
    '会話要約',           // 55
    '最終会話日時',       // 56
    '会話数',             // 57
    '重複フラグ',         // 58
    '重複元リードID',     // 59
    '重複確認日',         // 60
    '重複確認者',          // 61
    'リードステータス'    // 62
  ],
  STAFF: [
    '担当者ID', '苗字（日本語）', '名前（日本語）', '苗字（英語）', '名前（英語）',
    'メール', 'Discord ID', '役割', 'ステータス', '元候補者ID'
  ],
  WEEKLY_REPORT: [
    'レポートID', '担当者ID', '担当者名', '対象週', '今週の成果', '良かった点',
    '改善点', '来週の目標', '困っていること', 'Buddyへの質問', 'Buddyフィードバック', '提出日時'
  ],
  MONTHLY_REPORT: [
    'レポートID', '担当者ID', '担当者名', '対象月', '今月の成果', '良かった点',
    '改善点', '来月の目標', 'Buddyフィードバック', '提出日時'
  ],
  SHIFT: [
    'シフトID', '担当者ID', '担当者名', '対象週', '曜日',
    '時間帯1_開始', '時間帯1_終了', '時間帯2_開始', '時間帯2_終了',
    '時間帯3_開始', '時間帯3_終了', '提出日時', '更新日時'
  ],
  TEMPLATES: [
    'テンプレートID', 'テンプレート名', 'カテゴリ', '本文', '使用場面', '更新日'
  ],
  // 設定シートはDROPDOWN_COLUMNSを使用
  SETTINGS: DROPDOWN_COLUMNS,
  // 権限設定シートのヘッダー
  PERMISSIONS: [
    '役割名', 'dashboard_view', 'dashboard_cs', 'dashboard_sales', 'dashboard_leader',
    'lead_view', 'lead_add', 'lead_edit', 'lead_delete',
    'deal_view_all', 'deal_view_own', 'deal_edit', 'team_stats',
    'staff_manage', 'settings', 'admin_access', 'force_reset'
  ],
  // 会話ログシート（リード用・商談用共通：9列）
  CONVERSATION_LOG: [
    'ログID',         // 1: 自動採番（LOG-00001）
    'リードID',       // 2: LDI-00001 / LDO-00001
    '日時',           // 3: メッセージの日時
    '送受信',         // 4: 送信/受信
    '発言者',         // 5: 担当者名 or 顧客名
    '原文',           // 6: オリジナルメッセージ
    '翻訳文',         // 7: 日本語訳
    '記録者ID',       // 8: 記録した担当者ID
    '記録日時'        // 9: 記録した日時
  ],
  // 専門用語辞書シート（5列）
  TERM_DICTIONARY: [
    '英語',           // 1: Box
    '日本語',         // 2: ボックス
    'カテゴリ',       // 3: 商品形態
    '説明',           // 4: 30パック入り
    '有効'            // 5: TRUE/FALSE
  ],
  // お知らせシート（11列）
  NOTICES: [
    'お知らせID',     // 1: NOTICE-00001
    '日時',           // 2: 投稿日時
    '種別',           // 3: 重要/お知らせ/メンテナンス/個人
    'タイトル',       // 4: 件名
    '本文',           // 5: 内容
    '対象種別',       // 6: 全員/役割/個人
    '対象値',         // 7: 全員 / CS,営業 / EMP-001
    '有効期限',       // 8: 表示期限
    '作成者',         // 9: システム/管理者名
    'アクションURL',  // 10: リンク先（任意）
    'アクションラベル' // 11: ボタンラベル（任意）
  ],
  // 既読管理シート（3列）
  READ_STATUS: [
    '担当者ID',       // 1: EMP-001
    'お知らせID',     // 2: NOTICE-00001
    '既読日時'        // 3: 2026/01/13 10:30
  ],

  // ============================================================
  // ★ ERP統合: 見積・請求書管理ヘッダー ★
  // ============================================================

  // 見積書管理シート（23列）
  QUOTES: [
    '見積書ID',           // 1: QT-00001
    '商談ID',             // 2: LDI-00001
    '顧客ID',             // 3: CT-00001
    '顧客名',             // 4: ABC Trading
    '作成日',             // 5: 2026/01/23
    '有効期限',           // 6: 2026/02/23
    '通貨',               // 7: JPY/USD/EUR
    '商品小計',           // 8: 100000
    '配送料',             // 9: 5000
    '合計金額',           // 10: 105000
    'ステータス',         // 11: 下書き/送付済み/承認済み/却下/期限切れ
    '配送先国',           // 12: United States
    '配送先住所',         // 13: 123 Main St...
    '備考',               // 14: テキスト
    'PDFリンク',          // 15: Google DriveのURL
    '作成者ID',           // 16: EMP-001
    '作成者名',           // 17: 山田太郎
    '送付日',             // 18: 2026/01/24
    '承認日',             // 19: 2026/01/25
    '更新日',             // 20: 自動
    '請求書ID',           // 21: INV-00001（承認後に請求書変換時）
    '請求書変換日',       // 22: 2026/01/26
    'メモ'                // 23: 内部メモ
  ],

  // 見積書明細シート（15列）
  QUOTE_ITEMS: [
    '明細ID',             // 1: QTI-00001
    '見積書ID',           // 2: QT-00001
    '商品ID',             // 3: PRD-00001
    '商品名（英語）',     // 4: Product Name
    '商品名（日本語）',   // 5: 商品名
    'カテゴリ',           // 6: Pokemon
    '状態',               // 7: Sealed/Damaged/Case
    '数量',               // 8: 10
    '単価',               // 9: 10000
    '小計',               // 10: 100000
    '重量（kg）',         // 11: 0.5
    'マーク',             // 12: SV9a
    '発売日',             // 13: 2026/01/15
    '在庫数',             // 14: 50
    '備考'                // 15: テキスト
  ],

  // 請求書管理シート（29列）
  INVOICES: [
    '請求書ID',           // 1: INV-00001
    '請求書番号',         // 2: #0001
    '商談ID',             // 3: LDI-00001
    '顧客ID',             // 4: CT-00001
    '顧客名',             // 5: ABC Trading
    '請求日',             // 6: 2026/01/26
    '支払期限',           // 7: 2026/02/26
    '通貨',               // 8: JPY/USD/EUR
    '商品小計',           // 9: 100000
    '配送料',             // 10: 5000
    '合計金額',           // 11: 105000
    '支払済み金額',       // 12: 0
    '残額',               // 13: 105000
    'ステータス',         // 14: 下書き/送付済み/入金済み/部分入金/期限超過
    '決済方法',           // 15: 銀行振込/PayPal/Wise
    '請求先国',           // 16: United States
    '請求先住所',         // 17: Billing address
    '配送先国',           // 18: United States
    '配送先住所',         // 19: Delivery address
    '備考',               // 20: テキスト
    'PDFリンク',          // 21: Google DriveのURL
    '作成者ID',           // 22: EMP-001
    '作成者名',           // 23: 山田太郎
    '送付日',             // 24: 2026/01/27
    '入金日',             // 25: 2026/02/10
    '更新日',             // 26: 自動
    'ERP出力日',          // 27: 2026/02/10
    'ERP出力済み',        // 28: TRUE/FALSE
    'メモ'                // 29: 内部メモ
  ],

  // 請求書明細シート（15列）
  INVOICE_ITEMS: [
    '明細ID',             // 1: INVI-00001
    '請求書ID',           // 2: INV-00001
    '商品ID',             // 3: PRD-00001
    '商品名（英語）',     // 4: Product Name
    '商品名（日本語）',   // 5: 商品名
    'カテゴリ',           // 6: Pokemon
    '状態',               // 7: Sealed/Damaged/Case
    '数量',               // 8: 10
    '単価',               // 9: 10000
    '小計',               // 10: 100000
    '重量（kg）',         // 11: 0.5
    'マーク',             // 12: SV9a
    '発売日',             // 13: 2026/01/15
    '出荷済み',           // 14: TRUE/FALSE
    '備考'                // 15: テキスト
  ],

  // M_Customer（顧客マスタ）シート（28列）
  CUSTOMER_MASTER: [
    '顧客ID',             // 1: CT-00001
    '登録日',             // 2: 2026/01/23
    'Billing Name',       // 3: ABC Trading LLC
    'Billing Phone',      // 4: +1-234-567-8900
    'Billing Email',      // 5: contact@abc.com
    'Business ID',        // 6: 12-3456789
    'Billing Address 1',  // 7: 123 Main Street
    'Billing Address 2',  // 8: Suite 100
    'Billing City',       // 9: New York
    'Billing State',      // 10: NY
    'Billing ZIP',        // 11: 10001
    'Billing Country',    // 12: United States
    'Delivery Name',      // 13: ABC Trading Warehouse
    'Delivery Phone',     // 14: +1-234-567-8901
    'Delivery Address 1', // 15: 456 Warehouse Rd
    'Delivery Address 2', // 16: Building A
    'Delivery City',      // 17: Los Angeles
    'Delivery State',     // 18: CA
    'Delivery ZIP',       // 19: 90001
    'Delivery Country',   // 20: United States
    'ステータス',         // 21: Active/Inactive
    '初回取引日',         // 22: 2026/02/01
    '累計取引金額',       // 23: 0
    '最終取引日',         // 24: 空
    '取引回数',           // 25: 0
    '備考',               // 26: テキスト
    '更新日',             // 27: 自動
    '登録経路'            // 28: フォーム/手動/インポート
  ],

  // CRM顧客マスタ（19列: 電話番号をナショナル番号+国番号に分離）
  CRM_CUSTOMERS: [
    '顧客ID',            // 1: CT-00001
    '源流リードID',      // 2: LDI-00001 / LDO-00001
    '顧客名',            // 3
    '国',                // 4
    'メール',            // 5
    '電話番号',          // 6: ナショナル番号（例: 312345678）
    '国番号',            // 7: 国番号のみ（例: 81）← PR36で追加
    '初回取引日',        // 8
    '登録日',            // 9
    '営業担当者',                // 10: 35_SalesDataSyncService.js 参照中
    '連絡ツール',                // 11
    'FedEx ID',                  // 12
    '発送時メモ',                // 13
    'Discord参加',               // 14
    'Discord チャンネルID',      // 15: 33_DiscordIntegrationService.js 参照中
    'Discord ユーザーID',        // 16: 33_DiscordIntegrationService.js 参照中
    'Discrod 請求書 webhook',    // 17: ※旧スペルミスを厳密維持
    'Discrod 発送通知 webhook',  // 18: ※旧スペルミスを厳密維持
    'Shippment webhook'          // 19: ※旧スペルミスを厳密維持
  ],

  // 配送先マスタ（16列: 電話をナショナル番号+国番号に分離）
  CRM_SHIPPING: [
    '配送先ID',   // 1: AD-00001
    '顧客ID',     // 2: CT-00001
    '宛名',       // 3: D Name
    'Address 1',  // 4: D Address 1
    'Address 2',  // 5: D Address 2
    'Address 3',  // 6: D Address 3
    'City',       // 7: D City
    'State',      // 8: D State
    'Zip',        // 9: D Zip
    '国',         // 10: D Country
    '電話',       // 11: D Telephone ナショナル番号
    '国番号',     // 12: 国番号のみ ← PR36で追加
    'D Email',    // 13: 旧ヘッダー名維持
    'D Tax ID',   // 14: 旧ヘッダー名維持
    '既定',       // 15: TRUE/FALSE
    '有効'        // 16: TRUE/FALSE
  ],

  // 支払先マスタ（15列: Address 3 追加）
  CRM_PAYMENT: [
    '支払先ID',   // 1: PY-00001
    '顧客ID',     // 2: CT-00001
    '請求名義',   // 3: 支払い名義
    'Address 1',  // 4: B Address 1
    'Address 2',  // 5: B Address 2
    'Address 3',  // 6: B Address 3 ← PR17改訂で追加
    'City',       // 7: B City
    'State',      // 8: B State
    'Zip',        // 9: B Zip
    '国',         // 10: B Country
    '支払方法',   // 11: 空欄（旧データになし）
    '通貨',       // 12: 空欄（旧データになし）
    'B Tax ID',   // 13: VAT/税番号（顧客マスタから移設）
    '既定',       // 14: TRUE/FALSE
    '有効'        // 15: TRUE/FALSE
  ],

  // ============================================================
  // ★ オーダー管理（CRM内ネイティブ） ★
  // ============================================================

  // オーダー管理シート（26列: 1オーダー=1行）
  ORDER_MASTER: [
    'オーダーID',       // 1: OD-00001
    '請求書番号',       // 2: #0891
    '顧客ID',           // 3: CT-00001
    '配送先ID',         // 4: AD-00001
    '支払先ID',         // 5: PY-00001
    '源流リードID',     // 6: LDI-00001 / LDO-00001
    'ステータス',       // 7: 受注/処理中/発送済み/完了/キャンセル
    '受注日',           // 8: 2026/01/23
    '通貨',             // 9: JPY/USD/EUR
    '為替レート',       // 10: 150.5
    '明細合計',         // 11: 数量×単価の合計
    '送料',             // 12
    '関税',             // 13
    '請求総額',         // 14: 明細合計+送料+関税
    '決済手段',         // 15: 銀行振込/PayPal/Wise/クレジット
    '請求書リンク',     // 16: Google DriveのURL
    '請求書発行日',     // 17
    '支払期日',         // 18
    '支払確認日',       // 19
    '発送方法',         // 20: FedEx/UPS/EMS/他
    '発送日',           // 21
    '運送状番号',       // 22: 文字列固定（'@'書式）
    '発送時メモ',       // 23
    '備考',             // 24
    '登録日',           // 25: 自動
    '更新日'            // 26: 自動
  ],

  // オーダー明細シート（10列: 1明細=1行・SKU単位）
  ORDER_LINES: [
    '明細ID',           // 1: ODL-00001
    'オーダーID',       // 2: OD-00001
    '行番号',           // 3: 1, 2, 3...（同オーダー内の連番）
    'カテゴリ',         // 4: Pokemon/MTG/他
    '商品名',           // 5
    '状態',             // 6: Sealed/Damaged/Case/他
    'SKU',              // 7
    '数量',             // 8
    '単価',             // 9
    '小計'              // 10: 数量×単価
  ]
};

/**
 * 目標設定シートのヘッダー
 */
const GOALS_HEADERS = [
  '目標ID',
  '担当者ID',
  '担当者名',
  '期間タイプ',
  '期間',
  '商談数目標',
  '成約数目標',
  '成約率目標',
  '売上目標',
  'メモ',
  '作成日',
  '更新日'
];

/**
 * 権限項目の定義（表示名とキーのマッピング）
 */
const PERMISSION_DEFINITIONS = {
  // 基本機能
  dashboard_view: { name: 'ダッシュボード閲覧', category: '基本機能' },
  dashboard_cs: { name: 'CSダッシュボード', category: 'ダッシュボード' },
  dashboard_sales: { name: '営業ダッシュボード', category: 'ダッシュボード' },
  dashboard_leader: { name: 'リーダーダッシュボード', category: 'ダッシュボード' },
  lead_view: { name: 'リード一覧閲覧', category: 'リード管理' },
  lead_add: { name: 'リード追加', category: 'リード管理' },
  lead_edit: { name: 'リード編集', category: 'リード管理' },
  lead_delete: { name: 'リード削除', category: 'リード管理' },
  deal_view_all: { name: '商談閲覧（全員）', category: '商談管理' },
  deal_view_own: { name: '商談閲覧（自分のみ）', category: '商談管理' },
  deal_edit: { name: '商談編集', category: '商談管理' },
  team_stats: { name: 'チーム成績閲覧', category: '商談管理' },
  staff_manage: { name: '担当者管理', category: '管理機能' },
  settings: { name: '設定変更', category: '管理機能' },
  admin_access: { name: '管理者設定アクセス', category: '管理機能' },
  force_reset: { name: '強制リセット', category: '管理機能' }
};

/**
 * デフォルト役割定義
 */
const DEFAULT_ROLES = {
  'オーナー': {
    dashboard_view: true,
    dashboard_cs: true,
    dashboard_sales: true,
    dashboard_leader: true,
    lead_view: true,
    lead_add: true,
    lead_edit: true,
    lead_delete: true,
    deal_view_all: true,
    deal_view_own: true,
    deal_edit: true,
    team_stats: true,
    staff_manage: true,
    settings: true,
    admin_access: true,
    force_reset: true
  },
  'システム管理者': {
    dashboard_view: true,
    dashboard_cs: true,
    dashboard_sales: true,
    dashboard_leader: true,
    lead_view: true,
    lead_add: false,
    lead_edit: false,
    lead_delete: false,
    deal_view_all: true,
    deal_view_own: false,
    deal_edit: false,
    team_stats: true,
    staff_manage: true,
    settings: true,
    admin_access: true,
    force_reset: false
  },
  'リーダー': {
    dashboard_view: true,
    dashboard_cs: true,
    dashboard_sales: true,
    dashboard_leader: true,
    lead_view: true,
    lead_add: true,
    lead_edit: true,
    lead_delete: true,
    deal_view_all: true,
    deal_view_own: true,
    deal_edit: true,
    team_stats: true,
    staff_manage: true,
    settings: false,
    admin_access: false,
    force_reset: false
  },
  '営業': {
    dashboard_view: true,
    dashboard_cs: false,
    dashboard_sales: true,
    dashboard_leader: false,
    lead_view: false,
    lead_add: false,
    lead_edit: false,
    lead_delete: false,
    deal_view_all: false,
    deal_view_own: true,
    deal_edit: true,
    team_stats: true,
    staff_manage: false,
    settings: false,
    admin_access: false,
    force_reset: false
  },
  'CS': {
    dashboard_view: true,
    dashboard_cs: true,
    dashboard_sales: false,
    dashboard_leader: false,
    lead_view: true,
    lead_add: true,
    lead_edit: true,
    lead_delete: false,
    deal_view_all: false,
    deal_view_own: false,
    deal_edit: false,
    team_stats: false,
    staff_manage: false,
    settings: false,
    admin_access: false,
    force_reset: false
  }
};

/**
 * スクリプトプロパティから値を取得
 */
function getProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * Discord Webhook URL取得
 */
function getDiscordWebhook() {
  return getProperty('DISCORD_WEBHOOK_URL');
}

/**
 * リマインド用Discord Webhook URL取得
 */
function getRemindWebhook() {
  return getProperty('NSREMIND_DISCORDWEBHOOK') || getProperty('DISCORD_WEBHOOK_URL');
}

/**
 * 設定シートから単一キーの設定値を取得する。
 * 「設定キー」列が存在しない場合や行が見つからない場合は null を返す。
 *
 * @param {string} key - 設定キー（例: 'REMINDER_ENABLED'）
 * @returns {string|null} 設定値、または null
 */
function getSettingValue(key) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyCol = headers.indexOf('設定キー');
  const valCol = headers.indexOf('設定値');
  if (keyCol < 0 || valCol < 0) return null;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyCol]) === key) {
      return String(data[i][valCol]);
    }
  }
  return null;
}

/**
 * プルダウン選択肢を取得（クライアント用）
 * 設定シートから動的に読み取る
 */
function getDropdownOptions() {
  // キャッシュをチェック
  const cacheKey = 'DROPDOWN_OPTIONS_CACHE';
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // キャッシュが壊れている場合は再取得
    }
  }

  // 設定シートから取得
  const options = getDropdownOptionsFromSheet();

  // キャッシュに保存（10分間）
  try {
    cache.put(cacheKey, JSON.stringify(options), 600);
  } catch (e) {
    // キャッシュ保存エラーは無視
  }

  return options;
}

/**
 * 設定シートからプルダウン選択肢を取得
 */
function getDropdownOptionsFromSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  // シートがない、またはデータがない場合はデフォルト値を返す
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return DEFAULT_DROPDOWN_OPTIONS;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const options = {};

  // 各列のデータを取得
  headers.forEach((header, colIndex) => {
    if (!header) return;

    const values = [];
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
      const value = data[rowIndex][colIndex];
      if (value !== '' && value !== null && value !== undefined) {
        values.push(String(value));
      }
    }

    if (values.length > 0) {
      options[header] = values;
    }
  });

  // 取得できなかった項目はデフォルト値で補完
  Object.keys(DEFAULT_DROPDOWN_OPTIONS).forEach(key => {
    if (!options[key] || options[key].length === 0) {
      options[key] = DEFAULT_DROPDOWN_OPTIONS[key];
    }
  });

  return options;
}

/**
 * プルダウンキャッシュをクリア
 */
function clearDropdownCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('DROPDOWN_OPTIONS_CACHE');
  cache.remove('STATUS_OPTIONS_CACHE');
  Logger.log('プルダウンキャッシュをクリアしました');
}

/**
 * ステータス設定のデフォルト値
 * 基本的には設定シートを参照するが、設定シートがない場合のフォールバック
 */
const DEFAULT_STATUS_SETTINGS = {
  // リード段階のステータス（CSが使用）
  LEAD_STATUSES: [
    { value: '新規', order: 1, description: 'リード登録直後' },
    { value: '対応中', order: 2, description: 'CSが対応中' },
    { value: '対象外', order: 3, description: 'リード段階で対象外判定' }
  ],
  // 商談段階のステータス（営業が使用）
  DEAL_STATUSES: [
    { value: 'アサイン確定', order: 1, description: '営業にアサインされた直後' },
    { value: '商談中', order: 2, description: '商談進行中' },
    { value: '見積もり提示', order: 3, description: '見積書送付済み' }
  ],
  // 完了ステータス（共通）
  CLOSED_STATUSES: [
    { value: '成約', order: 1, description: '契約締結' },
    { value: '失注', order: 2, description: '失注確定' },
    { value: '追客', order: 3, description: '再アプローチ対象' },
    { value: '対象外', order: 4, description: '対象外判定' }
  ]
};

/**
 * 設定シートからステータス設定を取得
 * @returns {Object} ステータス設定オブジェクト
 */
function getStatusSettings() {
  // キャッシュをチェック
  const cacheKey = 'STATUS_OPTIONS_CACHE';
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // キャッシュが壊れている場合は再取得
    }
  }

  // 設定シートから取得
  const settings = getStatusSettingsFromSheet();

  // キャッシュに保存（10分間）
  try {
    cache.put(cacheKey, JSON.stringify(settings), 600);
  } catch (e) {
    // キャッシュ保存エラーは無視
  }

  return settings;
}

/**
 * 設定シートからステータス設定を取得（内部関数）
 */
function getStatusSettingsFromSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  // シートがない場合はデフォルト値を返す
  if (!sheet) {
    return DEFAULT_STATUS_SETTINGS;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // 「設定キー」列を探す（新形式の設定シート）
  const keyColIndex = headers.indexOf('設定キー');

  // 新形式の設定シートでない場合はデフォルト値を返す
  if (keyColIndex === -1) {
    return DEFAULT_STATUS_SETTINGS;
  }

  const valueColIndex = headers.indexOf('設定値');
  const descColIndex = headers.indexOf('説明');

  if (valueColIndex === -1) {
    return DEFAULT_STATUS_SETTINGS;
  }

  const result = {
    LEAD_STATUSES: [],
    DEAL_STATUSES: [],
    CLOSED_STATUSES: []
  };

  // データを解析
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][keyColIndex] || '');
    const value = String(data[i][valueColIndex] || '');
    const desc = descColIndex >= 0 ? String(data[i][descColIndex] || '') : '';

    if (!key || !value) continue;

    // LEAD_STATUS_N の形式
    if (key.startsWith('LEAD_STATUS_')) {
      const order = parseInt(key.replace('LEAD_STATUS_', ''));
      if (!isNaN(order)) {
        result.LEAD_STATUSES.push({ value, order, description: desc });
      }
    }
    // DEAL_STATUS_N の形式
    else if (key.startsWith('DEAL_STATUS_')) {
      const order = parseInt(key.replace('DEAL_STATUS_', ''));
      if (!isNaN(order)) {
        result.DEAL_STATUSES.push({ value, order, description: desc });
      }
    }
    // CLOSED_STATUS_N の形式
    else if (key.startsWith('CLOSED_STATUS_')) {
      const order = parseInt(key.replace('CLOSED_STATUS_', ''));
      if (!isNaN(order)) {
        result.CLOSED_STATUSES.push({ value, order, description: desc });
      }
    }
  }

  // orderでソート
  result.LEAD_STATUSES.sort((a, b) => a.order - b.order);
  result.DEAL_STATUSES.sort((a, b) => a.order - b.order);
  result.CLOSED_STATUSES.sort((a, b) => a.order - b.order);

  // データがない場合はデフォルト値で補完
  if (result.LEAD_STATUSES.length === 0) {
    result.LEAD_STATUSES = DEFAULT_STATUS_SETTINGS.LEAD_STATUSES;
  }
  if (result.DEAL_STATUSES.length === 0) {
    result.DEAL_STATUSES = DEFAULT_STATUS_SETTINGS.DEAL_STATUSES;
  }
  if (result.CLOSED_STATUSES.length === 0) {
    result.CLOSED_STATUSES = DEFAULT_STATUS_SETTINGS.CLOSED_STATUSES;
  }

  return result;
}

/**
 * リード段階のステータス一覧を取得（クライアント用）
 * @returns {Array} ステータス配列 [{value, description}, ...]
 */
function getLeadStatuses() {
  const settings = getStatusSettings();
  return settings.LEAD_STATUSES.map(s => ({
    value: s.value,
    description: s.description
  }));
}

/**
 * 商談段階のステータス一覧を取得（クライアント用）
 * @returns {Array} ステータス配列 [{value, description}, ...]
 */
function getDealStatuses() {
  const settings = getStatusSettings();
  return settings.DEAL_STATUSES.map(s => ({
    value: s.value,
    description: s.description
  }));
}

/**
 * 完了ステータス一覧を取得（クライアント用）
 * @returns {Array} ステータス配列 [{value, description}, ...]
 */
function getClosedStatuses() {
  const settings = getStatusSettings();
  return settings.CLOSED_STATUSES.map(s => ({
    value: s.value,
    description: s.description
  }));
}

/**
 * 全ステータスを取得（クライアント用）
 * @returns {Object} { leadStatuses, dealStatuses, closedStatuses }
 */
function getAllStatuses() {
  return {
    leadStatuses: getLeadStatuses(),
    dealStatuses: getDealStatuses(),
    closedStatuses: getClosedStatuses()
  };
}

// ============================================================
// データ取得（clasp run用）
// ============================================================

/**
 * 設定シートのデータを取得（clasp run用）
 * @returns {Object} 各列の選択肢データ
 */
function getSettingsData() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

  if (!sheet) {
    return { error: '設定シートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { error: '設定シートにデータがありません' };
  }

  const headers = data[0];
  const result = {};

  // 各列のデータを取得
  headers.forEach((header, colIndex) => {
    if (!header) return;

    const values = [];
    for (let row = 1; row < data.length; row++) {
      const value = data[row][colIndex];
      if (value !== '' && value !== null && value !== undefined) {
        values.push(value);
      }
    }
    result[header] = values;
  });

  return result;
}

/**
 * 担当者マスタのデータを取得（clasp run用）
 * @returns {Array} 担当者一覧
 */
function getStaffData() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet) {
    return { error: '担当者マスタが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { error: '担当者マスタにデータがありません' };
  }

  const headers = data[0];
  const staff = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = data[i][index];
    });
    staff.push(row);
  }

  return staff;
}

// ============================================================
// ファイル管理（clasp run用）
// ============================================================

/**
 * スプレッドシートを指定フォルダに移動
 * - 本番スプレッドシート → 本番フォルダ
 * - アーカイブブック → 本番フォルダ
 * - 開発スプレッドシート → 開発フォルダ
 */
function moveSpreadsheets() {
  const PROD_FOLDER_ID = '1JIPeqiT_2ucBUK875sQBcuSYHkT-GtdD';
  const DEV_FOLDER_ID = '1rV7ZKxZZtCubafp-9lMyCIPgmaAbJjh_';

  const props = PropertiesService.getScriptProperties();
  const devSpreadsheetId = props.getProperty('DEV_SPREADSHEET_ID') || '1G4ffyH8Abiki0861CjRvGiO_Ks_8wMiZKaWfujcOzvs';

  const filesToMove = [
    { id: PRODUCTION_IDS.SPREADSHEET_ID, targetFolder: PROD_FOLDER_ID, name: '本番スプレッドシート' },
    { id: PRODUCTION_IDS.ARCHIVE_BOOK_ID, targetFolder: PROD_FOLDER_ID, name: 'アーカイブブック' },
    { id: devSpreadsheetId, targetFolder: DEV_FOLDER_ID, name: '開発スプレッドシート' }
  ];

  const results = [];

  filesToMove.forEach(item => {
    try {
      const file = DriveApp.getFileById(item.id);
      const targetFolder = DriveApp.getFolderById(item.targetFolder);

      // 現在の親フォルダから削除
      const parents = file.getParents();
      while (parents.hasNext()) {
        parents.next().removeFile(file);
      }

      // 新しいフォルダに追加
      targetFolder.addFile(file);

      const result = item.name + ' → ' + targetFolder.getName() + ' に移動完了';
      Logger.log(result);
      results.push({ success: true, message: result });
    } catch (e) {
      const error = item.name + ' の移動に失敗: ' + e.message;
      Logger.log(error);
      results.push({ success: false, message: error });
    }
  });

  return results;
}
