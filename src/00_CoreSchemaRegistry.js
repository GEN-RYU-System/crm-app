const CORE_SCHEMA_V1_TABLES = {
  LEADS: {
    sheetName: 'リード管理', canonicalName: 'リード管理', aliases: [], headerRowNumber: 1, sheetType: 'TRANSACTION', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['LEAD_ID', 'リードID'], ['REGISTERED_AT', '登録日'], ['CUSTOMER_NAME', '顧客名'], ['DEAL_RESULT', '商談結果'], ['ENGLISH_CALL_NAME', '呼び方（英語）'], ['COUNTRY', '国'], ['SHEET_UPDATED_AT', 'シート更新日'], ['LEAD_ASSIGNEE_NAME', 'リード担当者'], ['LEAD_TYPE', 'リード種別'], ['LEAD_SOURCE', '流入経路'], ['LEAD_SOURCE_ID', '流入元ID'], ['MESSAGE_URL', 'メッセージURL'], ['HANDLED_TITLE', '取り扱いタイトル'], ['IP_IDS', '作品ID'], ['CS_NOTE', 'CSメモ'], ['EMAIL', 'メール'], ['PHONE', '電話番号'], ['CONTACT_METHOD', '連絡手段'], ['TEMPERATURE', '温度感'], ['EXPECTED_SCALE', '想定規模'], ['RESPONSE_SPEED', '返信速度'], ['INQUIRY_COUNT', '問い合わせ回数'], ['ARCHIVED_AT', 'アーカイブ日'], ['ARCHIVE_REASON', 'アーカイブ理由'], ['ASSIGNED_AT', 'アサイン日'], ['SALES_ASSIGNEE_NAME', '営業担当者'], ['ASSIGNEE_ID', '担当者ID'], ['CUSTOMER_TYPE', '顧客タイプ'], ['LAST_RESPONDER_ID', '最終対応者ID'], ['PROSPECT_SCORE', '見込度'], ['NEXT_ACTION', '次回アクション'], ['NEXT_ACTION_DATE', '次回アクション日'], ['DEAL_NOTE', '商談メモ'], ['CUSTOMER_ISSUE', '相手の課題'], ['SALES_CHANNEL', '販売形態'], ['MONTHLY_EXPECTED_AMOUNT', '月間見込み金額'], ['COMPETITOR_COMPARISON', '競合比較中'], ['ALERT_CONFIRMED_AT', 'アラート確認日'], ['EXCLUSION_REASON', '対象外理由'], ['LOSS_REASON', '失注理由'], ['FIRST_TRANSACTION_DATE', '初回取引日'], ['FIRST_TRANSACTION_AMOUNT', '初回取引金額'], ['CUMULATIVE_TRANSACTION_AMOUNT', '累計取引金額'], ['CONVERSATION_SUMMARY', '会話要約'], ['LAST_CONVERSATION_AT', '最終会話日時'], ['CONVERSATION_COUNT', '会話数'], ['DUPLICATE_FLAG', '重複フラグ'], ['DUPLICATE_SOURCE_LEAD_ID', '重複元リードID'], ['DUPLICATE_CONFIRMED_AT', '重複確認日'], ['DUPLICATE_CONFIRMED_BY', '重複確認者'], ['LEAD_STATUS', 'リードステータス']
    ]), primaryKey: 'LEAD_ID',
    referenceIds: [
      { headerKey: 'ASSIGNEE_ID', targetTableKey: 'STAFF' },
      { headerKey: 'LAST_RESPONDER_ID', targetTableKey: 'STAFF' },
      { headerKey: 'DUPLICATE_SOURCE_LEAD_ID', targetTableKey: 'LEADS' },
      { headerKey: 'LEAD_SOURCE_ID', targetTableKey: 'LEAD_SOURCES' }
    ]
  },
  CUSTOMERS: {
    sheetName: '顧客マスタ', canonicalName: '顧客マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['CUSTOMER_ID', '顧客ID'], ['SOURCE_LEAD_ID', '源流リードID'], ['CUSTOMER_NAME', '顧客名'], ['COUNTRY', '国'], ['EMAIL', 'メール'], ['PHONE', '電話番号'], ['COUNTRY_CODE', '国番号'], ['FIRST_TRANSACTION_DATE', '初回取引日'], ['REGISTERED_AT', '登録日'], ['SALES_ASSIGNEE_NAME', '営業担当者'], ['CONTACT_TOOL', '連絡ツール'], ['FEDEX_ID', 'fedex_id'], ['SHIPPING_NOTE', '発送時メモ'], ['CUSTOMER_SCALE', '顧客規模']]),
    primaryKey: 'CUSTOMER_ID',
    referenceIds: [{ headerKey: 'SOURCE_LEAD_ID', targetTableKey: 'LEADS' }]
  },
  SHIPPING_DESTINATIONS: {
    sheetName: '配送先マスタ', canonicalName: '配送先マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['SHIPPING_DESTINATION_ID', '配送先ID'], ['CUSTOMER_ID', '顧客ID'], ['RECIPIENT_NAME', '宛名'], ['ADDRESS_LINE_1', 'Address 1'], ['ADDRESS_LINE_2', 'Address 2'], ['ADDRESS_LINE_3', 'Address 3'], ['CITY', 'City'], ['STATE', 'State'], ['ZIP', 'Zip'], ['COUNTRY', '国'], ['PHONE', '電話'], ['COUNTRY_CODE', '国番号'], ['EMAIL', 'D Email'], ['TAX_ID', 'D Tax ID'], ['DISPLAY_NAME', '表示名'], ['IS_DEFAULT', '既定'], ['IS_ACTIVE', '有効']]), primaryKey: 'SHIPPING_DESTINATION_ID',
    referenceIds: [{ headerKey: 'CUSTOMER_ID', targetTableKey: 'CUSTOMERS' }]
  },
  PAYMENT_DESTINATIONS: {
    sheetName: '支払先マスタ', canonicalName: '支払先マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['PAYMENT_DESTINATION_ID', '支払先ID'], ['CUSTOMER_ID', '顧客ID'], ['BILLING_NAME', '請求名義'], ['ADDRESS_LINE_1', 'Address 1'], ['ADDRESS_LINE_2', 'Address 2'], ['ADDRESS_LINE_3', 'Address 3'], ['CITY', 'City'], ['STATE', 'State'], ['ZIP', 'Zip'], ['COUNTRY', '国'], ['PAYMENT_METHOD', '支払方法'], ['CURRENCY', '通貨'], ['TAX_ID', 'B Tax ID'], ['DISPLAY_NAME', '表示名'], ['IS_DEFAULT', '既定'], ['IS_ACTIVE', '有効']]), primaryKey: 'PAYMENT_DESTINATION_ID',
    referenceIds: [{ headerKey: 'CUSTOMER_ID', targetTableKey: 'CUSTOMERS' }]
  },
  ORDERS: {
    sheetName: 'オーダー管理', canonicalName: 'オーダー管理', aliases: [], headerRowNumber: 1, sheetType: 'TRANSACTION', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['ORDER_ID', 'オーダーID'], ['INVOICE_NUMBER', '請求書番号'], ['CUSTOMER_ID', '顧客ID'], ['SHIPPING_DESTINATION_ID', '配送先ID'], ['PAYMENT_DESTINATION_ID', '支払先ID'], ['SOURCE_LEAD_ID', '源流リードID'], ['STATUS', 'ステータス'], ['ORDER_DATE', '受注日'], ['CURRENCY', '通貨'], ['EXCHANGE_RATE', '為替レート'], ['LINE_TOTAL', '明細合計'], ['SHIPPING_FEE', '送料'], ['DUTY', '関税'], ['INVOICE_TOTAL', '請求総額'], ['PAYMENT_METHOD', '決済手段'], ['INVOICE_LINK', '請求書リンク'], ['INVOICE_ISSUED_AT', '請求書発行日'], ['PAYMENT_DUE_AT', '支払期日'], ['PAYMENT_CONFIRMED_AT', '支払確認日'], ['PAYMENT_CONFIRMATION_SOURCE', '入金確認元'], ['SHIPPING_METHOD', '発送方法'], ['SHIPPED_AT', '発送日'], ['TRACKING_NUMBER', '運送状番号'], ['SHIPPING_NOTE', '発送時メモ'], ['NOTE', '備考'], ['REGISTERED_AT', '登録日'], ['UPDATED_AT', '更新日'], ['ORDER_ASSIGNEE_ID', '受注担当ID'], ['PAYMENT_CONFIRMED_BY_ID', '入金確認者ID'], ['SALES_ASSIGNEE_ID', '営業担当ID'], ['SHIPPING_ASSIGNEE_ID', '発送担当ID'], ['TRANSACTION_NOTE', '取引備考欄'], ['RESERVED_INVOICE_NUMBER', '予約請求書番号'], ['RELEASE_SCHEDULED_AT', '発売予定日'], ['DEPOSIT_RATE', 'デポジット率'], ['OTHER_FEE', 'その他手数料'], ['DISCOUNT', '値引き'], ['PAYMENT_TERMS', '支払サイト'], ['CANCELLATION_REASON', 'キャンセル理由'], ['CANCELLATION_NOTE', 'キャンセルメモ'], ['PAYMENT_STATUS', '支払いステータス'], ['INVOICE_TOTAL_JPY', '円換算請求総額'], ['INTERNAL_NOTE', '内部メモ']
    ]), primaryKey: 'ORDER_ID',
    values: {
      PAYMENT_STATUS: {
        UNPAID:    '未入金',
        PARTIAL:   '一部入金',
        PAID:      '入金済み',
        OVERDUE:   '遅延',
        ON_HOLD:   '保留',
        CANCELLED: 'キャンセル'
      },
      PAYMENT_CONFIRMATION_SOURCE: {
        MANUAL:      '手動',
        PAYPAL_AUTO: 'PayPal自動'
      },
      PAYMENT_METHOD: {
        WISE:   'Wise',
        PAYPAL: 'PayPal'
      },
      STATUS: {
        AWAITING_PAYMENT: '支払い待ち',
        SOURCING: '仕入れ中',
        AWAITING_SHIPPING: '発送待ち',
        COMPLETED: '完了',
        TROUBLE: 'トラブル',
        CANCELLED: 'キャンセル',
        UNKNOWN: '不明'
      }
    },
    referenceIds: [
      { headerKey: 'CUSTOMER_ID', targetTableKey: 'CUSTOMERS' },
      { headerKey: 'SHIPPING_DESTINATION_ID', targetTableKey: 'SHIPPING_DESTINATIONS' },
      { headerKey: 'PAYMENT_DESTINATION_ID', targetTableKey: 'PAYMENT_DESTINATIONS' },
      { headerKey: 'SOURCE_LEAD_ID', targetTableKey: 'LEADS' },
      { headerKey: 'ORDER_ASSIGNEE_ID', targetTableKey: 'STAFF' },
      { headerKey: 'PAYMENT_CONFIRMED_BY_ID', targetTableKey: 'STAFF' },
      { headerKey: 'SALES_ASSIGNEE_ID', targetTableKey: 'STAFF' },
      { headerKey: 'SHIPPING_ASSIGNEE_ID', targetTableKey: 'STAFF' }
    ]
  },
  ORDER_LINES: {
    sheetName: 'オーダー明細', canonicalName: 'オーダー明細', aliases: [], headerRowNumber: 1, sheetType: 'CHILD', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['ORDER_LINE_ID', '明細ID'], ['ORDER_ID', 'オーダーID'], ['LINE_NUMBER', '行番号'], ['CATEGORY', 'カテゴリ'], ['PRODUCT_NAME', '商品名'], ['STATUS', '状態'], ['SKU', 'SKU'], ['QUANTITY', '数量'], ['UNIT_PRICE', '単価'], ['SUBTOTAL', '小計'], ['PRODUCT_ID', '商品ID']]), primaryKey: 'ORDER_LINE_ID',
    referenceIds: [{ headerKey: 'ORDER_ID', targetTableKey: 'ORDERS' }, { headerKey: 'PRODUCT_ID', targetTableKey: 'PRODUCTS' }]
  },
  QUOTES: {
    sheetName: '見積もり管理', canonicalName: '見積もり管理', aliases: [], headerRowNumber: 1, sheetType: 'TRANSACTION', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['QUOTE_ID', '見積書ID'], ['LEAD_ID', 'リードID'], ['CUSTOMER_ID', '顧客ID'], ['ORDER_ID', 'オーダーID'], ['STAFF_ID', '担当者ID'], ['ISSUED_DATE', '発行日'], ['EXPIRY_DATE', '有効期限'], ['STATUS', 'ステータス'], ['CURRENCY', '通貨'], ['EXCHANGE_RATE', '為替レート'], ['SUBTOTAL', '小計'], ['SHIPPING_FEE', '送料'], ['DISCOUNT', '値引き'], ['TOTAL_AMOUNT', '合計金額'], ['TOTAL_AMOUNT_JPY', '円換算合計'], ['PDF_URL', 'pdf_url'], ['NOTE', '備考'], ['CREATED_AT', '作成日時'], ['UPDATED_AT', '更新日時']
    ]), primaryKey: 'QUOTE_ID',
    // PR-3 でフォールバック削除後は headerAliasMap ごと除去すること
    headerAliasMap: { 'pdf_url': 'PDF URL' },
    values: {
      STATUS: {
        DRAFT:   '下書き',
        ISSUED:  '発行済み',
        EXPIRED: '期限切れ'
      }
    },
    referenceIds: [
      { headerKey: 'LEAD_ID', targetTableKey: 'LEADS' },
      { headerKey: 'CUSTOMER_ID', targetTableKey: 'CUSTOMERS' },
      { headerKey: 'ORDER_ID', targetTableKey: 'ORDERS' },
      { headerKey: 'STAFF_ID', targetTableKey: 'STAFF' }
    ]
  },
  ISSUER: {
    sheetName: '発行元マスタ', canonicalName: '発行元マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['ISSUER_ID',       '発行元ID'],
      ['COMPANY_NAME',    '会社名'],
      ['CONTACT_NAME',    '担当者名'],
      ['ADDRESS_LINE1',   'Address 1'],
      ['ADDRESS_LINE2',   'Address 2'],
      ['ADDRESS_LINE3',   'Address 3'],
      ['CITY',            'City'],
      ['STATE',           'State'],
      ['ZIP',             'Zip'],
      ['COUNTRY',         '国'],
      ['PHONE',           '電話番号'],
      ['EMAIL',           'メール'],
      ['REGISTRATION_NO', '登録番号'],
      ['PAYEE_NAME',      '受取名義'],
      ['PAYMENT_EMAIL',   '受取先メール'],
      ['PAYMENT_NOTE',    '注記'],
      ['CLOSING_MESSAGE', '結びの文'],
      ['IS_ACTIVE',       '有効'],
    ]), primaryKey: 'ISSUER_ID',
    referenceIds: []
  },
  QUOTE_LINES: {
    sheetName: '見積もり明細', canonicalName: '見積もり明細', aliases: [], headerRowNumber: 1, sheetType: 'CHILD', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['QUOTE_LINE_ID', '明細ID'], ['QUOTE_ID', '見積書ID'], ['LINE_NO', '行番号'], ['PRODUCT_ID', '商品ID'], ['PRODUCT_NAME', '商品名'], ['DESCRIPTION', '説明'],
      ['CONDITION', '状態'], ['WEIGHT', '重量'],
      ['QUANTITY', '数量'], ['UNIT_PRICE', '単価'], ['AMOUNT', '金額'], ['NOTE', '備考']
    ]), primaryKey: 'QUOTE_LINE_ID',
    referenceIds: [
      { headerKey: 'QUOTE_ID', targetTableKey: 'QUOTES' }
    ]
  },
  SHIPMENTS: {
    sheetName: '発送', canonicalName: '発送管理', aliases: ['発送'], headerRowNumber: 1, sheetType: 'CHILD', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['SHIPMENT_ID', '発送ID'], ['ORDER_ID', 'オーダーID'], ['BOX_NUMBER', '箱番号'], ['SHIPPING_METHOD', '発送方法'], ['SHIPPED_AT', '発送日'], ['TRACKING_NUMBER', '運送状番号'], ['LENGTH', '長さ'], ['WIDTH', '幅'], ['HEIGHT', '高さ'], ['WEIGHT', '重量'], ['ESTIMATED_SHIPPING_FEE', '見積もり送料'], ['LABEL_URL', 'ラベルURL'], ['INVOICE_URL', 'インボイスURL'], ['INSPECTION', '検品'], ['PACKING', '梱包'], ['STORAGE', '格納'], ['PICKUP_REQUEST', '集荷依頼'], ['NOTIFICATION', '通知'], ['SHIPPING_ASSIGNEE_ID', '発送担当ID'], ['NOTE', '備考'], ['REGISTERED_AT', '登録日'], ['UPDATED_AT', '更新日']]), primaryKey: 'SHIPMENT_ID',
    referenceIds: [{ headerKey: 'ORDER_ID', targetTableKey: 'ORDERS' }, { headerKey: 'SHIPPING_ASSIGNEE_ID', targetTableKey: 'STAFF' }]
  },
  PURCHASES: {
    sheetName: '仕入れ', canonicalName: '仕入れ管理', aliases: ['仕入れ'], headerRowNumber: 1, sheetType: 'CHILD', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['PURCHASE_ID', 'purchase_id'], ['ORDER_ID', 'order_id'], ['PURCHASE_ASSIGNEE_ID', 'purchase_assignee_id'], ['PAID_BY_ID', 'paid_by_id'], ['ORDERED_AT', 'ordered_at'], ['PAID_AT', 'paid_at'], ['TRANSACTION_NUMBER', 'transaction_number'], ['SUPPLIER', 'supplier'], ['SUPPLIER_URL', 'supplier_url'], ['QUANTITY', 'quantity'], ['UNIT_PRICE', 'unit_price'], ['AMOUNT', 'amount'], ['SHIPPING_OR_AGENCY_FEE', 'shipping_or_agency_fee'], ['CARRIER', 'carrier'], ['TRACKING_NUMBER', 'tracking_number'], ['STATUS', 'status'], ['NOTE', 'note'], ['REGISTERED_AT', 'registered_at'], ['UPDATED_AT', 'updated_at']]), primaryKey: 'PURCHASE_ID',
    values: {
      STATUS: {
        CONFIRMED: '確定済み',
        NOT_ORDERED: '未発注',
        ORDERED: '発注済み',
        PAID: '支払済み'
      }
    },
    referenceIds: [{ headerKey: 'ORDER_ID', targetTableKey: 'ORDERS' }, { headerKey: 'PURCHASE_ASSIGNEE_ID', targetTableKey: 'STAFF' }, { headerKey: 'PAID_BY_ID', targetTableKey: 'STAFF' }]
  },
  FORM_TOKENS: {
    sheetName: 'フォームトークン', canonicalName: 'フォームトークン', aliases: [], headerRowNumber: 1, sheetType: 'ASSOCIATION', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['FORM_TOKEN', 'トークン'], ['LEAD_ID', 'リードID'], ['ISSUED_AT', '発行日'], ['USED_AT', '使用日']]), primaryKey: 'FORM_TOKEN',
    referenceIds: [{ headerKey: 'LEAD_ID', targetTableKey: 'LEADS' }]
  },
  PRODUCTS: {
    sheetName: '商品マスタ同期', canonicalName: '商品マスタ同期', aliases: [], headerRowNumber: 1, sheetType: 'SYNC_MASTER', writeAllowed: false,
    headers: createCoreSchemaV1Headers([['PRODUCT_ID', 'product_id'], ['CATEGORY', 'Category'], ['MARK', 'Mark'], ['JAPANESE_TITLE', 'Japanese Title'], ['ENGLISH_TITLE', 'English Title'], ['BOXES_PER_CASE', 'Boxes per Case'], ['PACKS_PER_BOX', 'Packs per Box'], ['VOLUME_WEIGHT', 'VOLUME WEIGHT'], ['BOX_WEIGHT', 'Box重量'], ['CASE_WEIGHT', 'Case重量'], ['RELEASE_DATE', 'Release Date'], ['SEARCH_KEYWORDS', 'Search Keywords'], ['EXCLUDE_KEYWORDS', 'Exclude Keywords'], ['RELATED_SERIES', 'Related Series'], ['CATEGORY_CLASSIFICATION', 'カテゴリ分類'], ['REQUIRED_OUTPUT_VALUE', 'REQUIRED_OUTPUT_VALUE'], ['MOQ', 'MOQ'], ['ITEM', '品目'], ['HS_CODE', 'HSコード'], ['MATERIAL', '素材'], ['MAJOR_CATEGORY_ID', '大分類ID'], ['WORK_ID', '作品ID'], ['MANUFACTURER_ID', 'メーカーID'], ['PRODUCT_CATEGORY_ID', 'product_category_ID']]), primaryKey: 'PRODUCT_ID', referenceIds: [],
    unmanagedReferenceIds: [
      { headerKey: 'MAJOR_CATEGORY_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' },
      { headerKey: 'WORK_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' },
      { headerKey: 'MANUFACTURER_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' },
      { headerKey: 'PRODUCT_CATEGORY_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' }
    ]
  },
  STAFF: {
    sheetName: '担当者マスタ', canonicalName: '担当者マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['STAFF_ID', '担当者ID'], ['LAST_NAME_JA', '苗字（日本語）'], ['FIRST_NAME_JA', '名前（日本語）'], ['FULL_NAME_JA', '氏名（日本語）'], ['LAST_NAME_KANA', '苗字ふりがな'], ['FIRST_NAME_KANA', '名前ふりがな'], ['LAST_NAME_EN', '苗字（英語）'], ['FIRST_NAME_EN', '名前（英語）'], ['EMAIL', 'メール'], ['DISCORD_ID', 'Discord ID'], ['ROLE', '役割'], ['STATUS', 'ステータス'], ['SOURCE_CANDIDATE_ID', '元候補者ID'], ['DARK_MODE', 'ダークモード'], ['CHAT_MENU_VISIBLE', 'チャットメニュー表示'], ['SALES_MENU_VISIBLE', '営業メニュー表示'], ['SETTINGS_MENU_VISIBLE', '設定メニュー表示'], ['ADMIN_MENU_VISIBLE', '管理者メニュー表示'], ['BUDDY_MAINTENANCE_MENU_VISIBLE', 'Buddyメンテナンスメニュー表示'], ['SIDEBAR_VISIBLE', 'サイドバー表示'], ['PASSWORD_HASH', 'パスワードハッシュ'], ['PASSWORD_SALT', 'パスワードソルト'], ['LOGIN_FAIL_COUNT', '連続失敗回数'], ['LOCKED_UNTIL', 'ロック解除時刻']]), primaryKey: 'STAFF_ID', referenceIds: [],
    unmanagedReferenceIds: [{ headerKey: 'SOURCE_CANDIDATE_ID', reason: 'PARENT_TABLE_OUTSIDE_CORE_SCHEMA_V1' }],
    values: {
      ROLE: {
        OWNER: 'オーナー',
        SYSTEM_ADMIN: 'システム管理者',
        LEADER: 'リーダー',
        SALES: '営業',
        CS: 'CS'
      },
      STATUS: {
        ACTIVE: '有効',
        INACTIVE: '無効'
      }
    }
  },
  LOGIN_SESSIONS: {
    sheetName: 'ログインセッション', canonicalName: 'ログインセッション', aliases: [], headerRowNumber: 1, sheetType: 'TRANSACTION', writeAllowed: true,
    headers: createCoreSchemaV1Headers([['SESSION_ID', 'セッションID'], ['STAFF_ID', '担当者ID'], ['ISSUED_AT', '発行日時'], ['LAST_USED_AT', '最終利用日時'], ['EXPIRES_AT', '失効日時'], ['STATUS', '状態']]), primaryKey: 'SESSION_ID',
    values: {
      STATUS: {
        ACTIVE:  '有効',
        EXPIRED: '期限切れ',
        REVOKED: '失効'
      }
    },
    referenceIds: [{ headerKey: 'STAFF_ID', targetTableKey: 'STAFF' }]
  },
  SHARED_INVENTORY: {
    // product_id が重複する（同一商品を複数の提供者が出す場合がある）ため primaryKey は null
    sheetName: '共用在庫', canonicalName: '共用在庫', aliases: [], headerRowNumber: 1, sheetType: 'SYNC_MASTER', writeAllowed: false,
    headers: createCoreSchemaV1Headers([
      ['SERIES', 'Series'], ['QUANTITY', 'Quantity'], ['UNIT_PRICE', 'Unit Price'],
      ['CONDITION', 'Condition'], ['STATUS', 'Status'], ['NOTE_JA', 'Note_JA'],
      ['NOTE_EN', 'Note_EN'], ['SUPPLIER', '提供者'], ['PRODUCT_ID', 'product_id'],
      ['RAW_NAME', 'raw_name'], ['EXCLUSION_REASON', '除外理由']
    ]), primaryKey: null,
    values: {
      CONDITION: {
        SEALED_BOX:         'Sealed box',
        DAMAGED_SEALED_BOX: 'Damaged sealed box',
        CASE:               'Case',
        NO_SHRINK_BOX:      'No shrink box',
        SEARCHED_PACK:      'Searched pack',
        FLAG_SINGLE:        'FLAG_SINGLE',
        DAMAGED_CASE:       'Damaged case',
        UNSEARCHED_PACK:    'Unsearched pack'
      }
    },
    referenceIds: [{ headerKey: 'PRODUCT_ID', targetTableKey: 'PRODUCTS' }]
  },
  COUNTRIES: {
    sheetName: '国マスタ', canonicalName: '国マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: false,
    headers: createCoreSchemaV1Headers([
      ['COUNTRY_CODE',      'country_code'],
      ['DISPLAY_NAME',      'display_name'],
      ['NAME_JA',           'name_ja'],
      ['COUNTRY_NUMBER',    '国番号'],
      ['STRIP_TRUNK_ZERO',  'トランク0除去'],
      ['IS_ACTIVE',         '有効'],
      ['STATE_REQUIRED',    '州必須'],
      ['ZIP_REQUIRED',      '郵便番号必須']
    ]), primaryKey: 'COUNTRY_CODE',
    referenceIds: []
  },
  CURRENCIES: {
    sheetName: '通貨マスタ', canonicalName: '通貨マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['CURRENCY_CODE', '通貨コード'],
      ['SYMBOL',        '記号'],
      ['NAME',          '名称'],
      ['RATE_TO_JPY',   '円換算レート'],
      ['IS_ACTIVE',     '有効']
    ]), primaryKey: 'CURRENCY_CODE',
    referenceIds: []
  },
  LEAD_SOURCES: {
    sheetName: '流入元マスタ', canonicalName: '流入元マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['SOURCE_ID',     'source_id'],
      ['NAME',          '名称'],
      ['IS_INBOUND',    'インバウンド'],
      ['IS_OUTBOUND',   'アウトバウンド'],
      ['IS_ACTIVE',     '有効'],
      ['DISPLAY_ORDER', '表示順']
    ]), primaryKey: 'SOURCE_ID',
    referenceIds: []
  },
  SETTINGS: {
    sheetName: 'システム設定', canonicalName: 'システム設定', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['SETTING_KEY',   '設定キー'],
      ['SETTING_VALUE', '設定値'],
      ['VALUE_TYPE',    '値の型'],
      ['DESCRIPTION',   '説明'],
      ['UPDATED_AT',    '更新日時']
    ]), primaryKey: 'SETTING_KEY',
    values: {
      VALUE_TYPE: {
        NUMBER:  '数値',
        TEXT:    'テキスト',
        BOOLEAN: '真偽値',
        DATE:    '日付'
      }
    },
    referenceIds: []
  },
  LEGACY_INPUT: {
    sheetName: '請求書作成', canonicalName: '請求書作成', aliases: [], headerRowNumber: 1, sheetType: 'LEGACY_INPUT', writeAllowed: false,
    headers: {}, primaryKey: null, referenceIds: []
  },
  LEGACY_SALES: {
    sheetName: '📊売上データ', canonicalName: '📊売上データ', aliases: [], headerRowNumber: 4, sheetType: 'LEGACY_SALES', writeAllowed: false,
    headers: {}, primaryKey: null, referenceIds: []
  },
  DISPLAY_SETTINGS: {
    sheetName: '表示設定マスタ', canonicalName: '表示設定マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['SETTING_KEY',   '設定キー'],
      ['SETTING_VALUE', '設定値'],
      ['TARGET_SCREEN', '対象画面'],
      ['STAFF_ID',      '担当者ID']
    ]), primaryKey: null,
    referenceIds: [{ headerKey: 'STAFF_ID', targetTableKey: 'STAFF' }]
  },
  ITEMS: {
    sheetName: '品目マスタ', canonicalName: '品目マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['ITEM_ID',       '品目ID'],
      ['NAME_EN',       '品目名（英語）'],
      ['NAME_JA',       '品目名（日本語）'],
      ['ACTIVE',        '有効'],
      ['REGISTERED_AT', '登録日'],
      ['UPDATED_AT',    '更新日']
    ]), primaryKey: 'ITEM_ID',
    referenceIds: []
  },
  HTS_CODES: {
    sheetName: 'HTSコードマスタ', canonicalName: 'HTSコードマスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['HTS_CODE_ID',   'HTSコードID'],
      ['HTS_CODE',      'HTSコード'],
      ['DESCRIPTION_EN','説明（英語）'],
      ['DESCRIPTION_JA','説明（日本語）'],
      ['ACTIVE',        '有効'],
      ['REGISTERED_AT', '登録日'],
      ['UPDATED_AT',    '更新日']
    ]), primaryKey: 'HTS_CODE_ID',
    referenceIds: []
  },
  MATERIALS: {
    sheetName: '素材マスタ', canonicalName: '素材マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['MATERIAL_ID',   '素材ID'],
      ['NAME_EN',       '素材名（英語）'],
      ['NAME_JA',       '素材名（日本語）'],
      ['ACTIVE',        '有効'],
      ['REGISTERED_AT', '登録日'],
      ['UPDATED_AT',    '更新日']
    ]), primaryKey: 'MATERIAL_ID',
    referenceIds: []
  },
  OWN_CATEGORIES: {
    sheetName: '自社大分類マスタ', canonicalName: '自社大分類マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['OWN_CATEGORY_ID', '自社大分類ID'],
      ['NAME_EN',         '名称（英語）'],
      ['NAME_JA',         '名称（日本語）'],
      ['ACTIVE',          '有効'],
      ['REGISTERED_AT',   '登録日'],
      ['UPDATED_AT',      '更新日']
    ]), primaryKey: 'OWN_CATEGORY_ID',
    referenceIds: []
  },
  OWN_WORKS: {
    sheetName: '自社作品マスタ', canonicalName: '自社作品マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['OWN_WORK_ID',   '自社作品ID'],
      ['NAME_EN',       '名称（英語）'],
      ['NAME_JA',       '名称（日本語）'],
      ['ACTIVE',        '有効'],
      ['REGISTERED_AT', '登録日'],
      ['UPDATED_AT',    '更新日']
    ]), primaryKey: 'OWN_WORK_ID',
    referenceIds: []
  },
  OWN_MANUFACTURERS: {
    sheetName: '自社メーカーマスタ', canonicalName: '自社メーカーマスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['OWN_MANUFACTURER_ID', '自社メーカーID'],
      ['NAME_EN',             '名称（英語）'],
      ['NAME_JA',             '名称（日本語）'],
      ['ACTIVE',              '有効'],
      ['REGISTERED_AT',       '登録日'],
      ['UPDATED_AT',          '更新日']
    ]), primaryKey: 'OWN_MANUFACTURER_ID',
    referenceIds: []
  },
  OWN_PRODUCTS: {
    sheetName: '自社商品マスタ', canonicalName: '自社商品マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['OWN_PRODUCT_ID',      '自社商品ID'],
      ['SHARED_PRODUCT_ID',   '共用商品ID'],
      ['NAME_EN',             '商品名（英語）'],
      ['NAME_JA',             '商品名（日本語）'],
      ['OWN_CATEGORY_ID',     '自社大分類ID'],
      ['OWN_WORK_ID',         '自社作品ID'],
      ['OWN_MANUFACTURER_ID', '自社メーカーID'],
      ['MEMO',                'メモ'],
      ['ACTIVE',              '有効'],
      ['REGISTERED_AT',       '登録日'],
      ['UPDATED_AT',          '更新日']
    ]), primaryKey: 'OWN_PRODUCT_ID',
    referenceIds: [
      { headerKey: 'OWN_CATEGORY_ID',     targetTableKey: 'OWN_CATEGORIES' },
      { headerKey: 'OWN_WORK_ID',         targetTableKey: 'OWN_WORKS' },
      { headerKey: 'OWN_MANUFACTURER_ID', targetTableKey: 'OWN_MANUFACTURERS' },
      { headerKey: 'SHARED_PRODUCT_ID',   targetTableKey: 'PRODUCTS' }
    ]
  },
  SIZES: {
    sheetName: 'サイズマスタ', canonicalName: 'サイズマスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['SIZE_ID',       'サイズID'],
      ['NAME',          'サイズ名'],
      ['LENGTH',        '長さ'],
      ['WIDTH',         '幅'],
      ['HEIGHT',        '高さ'],
      ['ACTIVE',        '有効'],
      ['REGISTERED_AT', '登録日'],
      ['UPDATED_AT',    '更新日']
    ]), primaryKey: 'SIZE_ID',
    referenceIds: []
  },
  WEIGHTS: {
    sheetName: '重量マスタ', canonicalName: '重量マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['WEIGHT_ID',     '重量ID'],
      ['NAME',          '重量名'],
      ['WEIGHT',        '重量'],
      ['ACTIVE',        '有効'],
      ['REGISTERED_AT', '登録日'],
      ['UPDATED_AT',    '更新日']
    ]), primaryKey: 'WEIGHT_ID',
    referenceIds: []
  },
  PACKAGES: {
    sheetName: '荷姿マスタ', canonicalName: '荷姿マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['PACKAGE_ID',    '荷姿ID'],
      ['NAME',          '荷姿名'],
      ['UNIT',          '単位'],
      ['QUANTITY',      '入数'],
      ['SIZE_ID',       'サイズID'],
      ['WEIGHT_ID',     '重量ID'],
      ['ACTIVE',        '有効'],
      ['REGISTERED_AT', '登録日'],
      ['UPDATED_AT',    '更新日']
    ]), primaryKey: 'PACKAGE_ID',
    values: {
      UNIT: {
        CASE: 'ケース',
        BOX:  'ボックス',
        PACK: 'パック'
      }
    },
    referenceIds: [
      { headerKey: 'SIZE_ID',   targetTableKey: 'SIZES' },
      { headerKey: 'WEIGHT_ID', targetTableKey: 'WEIGHTS' }
    ]
  },
  PRODUCT_PACKAGES: {
    sheetName: '商品荷姿マスタ', canonicalName: '商品荷姿マスタ', aliases: [], headerRowNumber: 1, sheetType: 'MASTER', writeAllowed: true,
    headers: createCoreSchemaV1Headers([
      ['PRODUCT_PACKAGE_ID', '商品荷姿ID'],
      ['SHARED_PRODUCT_ID',  '共用商品ID'],
      ['OWN_PRODUCT_ID',     '自社商品ID'],
      ['CASE_PACKAGE_ID',    'ケース荷姿ID'],
      ['BOX_PACKAGE_ID',     'ボックス荷姿ID'],
      ['PACK_PACKAGE_ID',    'パック荷姿ID'],
      ['ITEM_ID',            '品目ID'],
      ['HTS_CODE_ID',        'HTSコードID'],
      ['MATERIAL_ID',        '素材ID'],
      ['ACTIVE',             '有効'],
      ['REGISTERED_AT',      '登録日'],
      ['UPDATED_AT',         '更新日']
    ]), primaryKey: 'PRODUCT_PACKAGE_ID',
    referenceIds: [
      { headerKey: 'SHARED_PRODUCT_ID', targetTableKey: 'PRODUCTS' },
      { headerKey: 'OWN_PRODUCT_ID',    targetTableKey: 'OWN_PRODUCTS' },
      { headerKey: 'CASE_PACKAGE_ID',   targetTableKey: 'PACKAGES' },
      { headerKey: 'BOX_PACKAGE_ID',    targetTableKey: 'PACKAGES' },
      { headerKey: 'PACK_PACKAGE_ID',   targetTableKey: 'PACKAGES' },
      { headerKey: 'ITEM_ID',           targetTableKey: 'ITEMS' },
      { headerKey: 'HTS_CODE_ID',       targetTableKey: 'HTS_CODES' },
      { headerKey: 'MATERIAL_ID',       targetTableKey: 'MATERIALS' }
    ]
  }
};

function createCoreSchemaV1Headers(headerEntries) {
  return headerEntries.reduce((headers, entry) => {
    headers[entry[0]] = entry[1];
    return headers;
  }, {});
}

function getCoreSchemaV1Table(tableKey) {
  const table = CORE_SCHEMA_V1_TABLES[tableKey];
  if (!table) throw new Error('CORE_SCHEMA_TABLE_KEY_NOT_FOUND');
  return table;
}

function resolveCoreSchemaV1TableKey(tableKeyOrAlias) {
  if (CORE_SCHEMA_V1_TABLES[tableKeyOrAlias]) return tableKeyOrAlias;
  const matchedKey = Object.keys(CORE_SCHEMA_V1_TABLES).find(tableKey => {
    const table = CORE_SCHEMA_V1_TABLES[tableKey];
    return table.sheetName === tableKeyOrAlias || table.canonicalName === tableKeyOrAlias || table.aliases.indexOf(tableKeyOrAlias) !== -1;
  });
  if (!matchedKey) throw new Error('CORE_SCHEMA_TABLE_KEY_NOT_FOUND');
  return matchedKey;
}

function getCoreSchemaV1TableName(tableKey) {
  return getCoreSchemaV1Table(resolveCoreSchemaV1TableKey(tableKey)).sheetName;
}

function getCoreSchemaV1HeaderName(tableKey, headerKey) {
  const headerName = getCoreSchemaV1Table(resolveCoreSchemaV1TableKey(tableKey)).headers[headerKey];
  if (!headerName) throw new Error('CORE_SCHEMA_HEADER_KEY_NOT_FOUND');
  return headerName;
}
function getCoreSchemaV1Value(tableKey, valueGroupKey, valueKey) {
  const table = getCoreSchemaV1Table(resolveCoreSchemaV1TableKey(tableKey));
  const group = table.values && table.values[valueGroupKey];
  if (!group || !Object.prototype.hasOwnProperty.call(group, valueKey)) {
    throw new Error('CORE_SCHEMA_VALUE_KEY_NOT_FOUND');
  }
  return group[valueKey];
}

function getCoreSchemaV1Sheet(spreadsheet, tableKey) {
  const table = getCoreSchemaV1Table(resolveCoreSchemaV1TableKey(tableKey));
  const candidateNames = [table.sheetName].concat(table.aliases, [table.canonicalName]);
  const sheet = candidateNames.map(name => spreadsheet.getSheetByName(name)).find(Boolean);
  if (!sheet) throw new Error('CORE_SCHEMA_REQUIRED_TAB_MISSING');
  return sheet;
}

function validateCoreSchemaV1TableForWrite(spreadsheet, tableKey) {
  const table = getCoreSchemaV1Table(resolveCoreSchemaV1TableKey(tableKey));
  if (!table.writeAllowed) throw new Error('CORE_SCHEMA_WRITE_NOT_ALLOWED');
  const sheet = getCoreSchemaV1Sheet(spreadsheet, tableKey);
  const columnCount = sheet.getLastColumn();
  const headers = columnCount > 0
    ? sheet.getRange(table.headerRowNumber, 1, 1, columnCount).getDisplayValues()[0].map(header => String(header).trim())
    : [];
  const nonEmptyHeaders = headers.filter(Boolean);
  if (new Set(nonEmptyHeaders).size !== nonEmptyHeaders.length) {
    throw new Error('CORE_SCHEMA_NON_EMPTY_HEADER_DUPLICATE');
  }
  const aliasMap = table.headerAliasMap || {};
  const requiredHeaders = Object.keys(table.headers).map(headerKey => table.headers[headerKey]);
  if (requiredHeaders.some(headerName => {
    return headers.indexOf(headerName) === -1 &&
           (!aliasMap[headerName] || headers.indexOf(aliasMap[headerName]) === -1);
  })) {
    throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING');
  }
  return {
    sheet: sheet,
    tableKey: resolveCoreSchemaV1TableKey(tableKey),
    headerIndexes: requiredHeaders.reduce((indexes, headerName) => {
      let idx = headers.indexOf(headerName);
      if (idx === -1 && aliasMap[headerName]) idx = headers.indexOf(aliasMap[headerName]);
      indexes[headerName] = idx + 1;
      return indexes;
    }, {})
  };
}
