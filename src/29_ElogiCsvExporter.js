/**
 * 29_ElogiCsvExporter.js
 *
 * 目的: 発送情報から eLogi 取り込み用 CSV を生成する。
 *       シートへの書き込みは一切行わない（読み取り専用）。
 *
 * Public functions:
 *   generateElogiCsvForFrontend(sessionId, shipmentId)
 *
 * 制約:
 *   - 顧客情報・金額をログに出力しない
 *   - 必須項目が空でもエラーにせず警告（warnings）として返す
 *   - CSV 列順・ヘッダー文字列は eLogi 仕様に固定
 *   - 文字コード: UTF-8
 *
 * Permission: lead_view（読み取り専用のため）
 */

/* global setEmailFromSession, checkPermission, getSpreadsheet,
   coreCustomerFrontendReadTable, coreCustomerFrontendValue */

// ─── CSV ヘッダー（eLogi 仕様固定・変更禁止）────────────────────────────────

var ELOGI_CSV_HEADERS = [
  '注文種類', '注文番号', '注文日', 'SKU', '商品画像URL', '商品タイトル', '数量',
  'USD申告単価/個', '購入者ID', '受取人氏名', '受取人会社名', '電話番号',
  'メールアドレス', '国名', '州コード/州名', '市', '郵便番号', '住所１', '住所２',
  '住所３', 'HS/HTSコード', '原産国', '受取人 納税者ID', '事前徴収ID', 'EORI番号'
];

// 列23の選択ロジックで参照する仕向国→TYPE_ID マッピング（eLogi 仕様固定）
var ELOGI_TAX_ID_COUNTRY_MAP = {
  US: 'US_TAX_ID',
  KR: 'PCCC',
  MX: 'RFC'
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 指定した発送の eLogi 取り込み用 CSV を生成して返す。
 *
 * 1発送明細 = CSV 1行。ヘッダー行を含む。
 * 必須項目が空の場合でも処理を止めず、warnings に記録して続行する。
 *
 * @param {string} sessionId
 * @param {string} shipmentId - 対象の発送ID（例: SH-0004）
 * @returns {{ csv: string, warnings: Array<{lineNo:number, field:string, reason:string}> }}
 */
function generateElogiCsvForFrontend(sessionId, shipmentId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (!shipmentId) throw new Error('MISSING_SHIPMENT_ID');
  shipmentId = String(shipmentId).trim();

  var ss = getSpreadsheet();

  // ── 1. 発送 → ORDER_ID 解決 ────────────────────────────────────────────────
  var shipData = coreCustomerFrontendReadTable(ss, 'SHIPMENTS', ['SHIPMENT_ID', 'ORDER_ID']);
  var shipRow = null;
  for (var si = 0; si < shipData.rows.length; si++) {
    if (coreCustomerFrontendValue(shipData.rows[si][shipData.indexes.SHIPMENT_ID]) === shipmentId) {
      shipRow = shipData.rows[si];
      break;
    }
  }
  if (!shipRow) throw new Error('SHIPMENT_NOT_FOUND');

  var orderId = coreCustomerFrontendValue(shipRow[shipData.indexes.ORDER_ID]);
  if (!orderId) throw new Error('SHIPMENT_HAS_NO_ORDER_ID');

  // ── 2. オーダー ──────────────────────────────────────────────────────────────
  var orderData = coreCustomerFrontendReadTable(ss, 'ORDERS', [
    'ORDER_ID', 'ORDER_SOURCE', 'ORDER_DATE',
    'EXCHANGE_RATE', 'CUSTOMER_ID', 'SHIPPING_DESTINATION_ID'
  ]);
  var orderRow = null;
  for (var oi = 0; oi < orderData.rows.length; oi++) {
    if (coreCustomerFrontendValue(orderData.rows[oi][orderData.indexes.ORDER_ID]) === orderId) {
      orderRow = orderData.rows[oi];
      break;
    }
  }
  if (!orderRow) throw new Error('ORDER_NOT_FOUND');

  var orderSource          = coreCustomerFrontendValue(orderRow[orderData.indexes.ORDER_SOURCE]);
  var orderDate            = elogiFormatDate_(orderRow[orderData.indexes.ORDER_DATE]);
  var exchangeRateRaw      = orderRow[orderData.indexes.EXCHANGE_RATE];
  var exchangeRate         = typeof exchangeRateRaw === 'number'
    ? exchangeRateRaw
    : parseFloat(String(exchangeRateRaw).replace(/,/g, '')) || 0;
  var customerId           = coreCustomerFrontendValue(orderRow[orderData.indexes.CUSTOMER_ID]);
  var shippingDestinationId = coreCustomerFrontendValue(orderRow[orderData.indexes.SHIPPING_DESTINATION_ID]);

  // ── 3. 発送明細（このshipmentId の行のみ）────────────────────────────────
  var slData = coreCustomerFrontendReadTable(ss, 'SHIPMENT_LINES', [
    'SHIPMENT_ID', 'ORDER_LINE_ID', 'HTS_CODE_ID', 'ORIGIN_COUNTRY', 'QUANTITY'
  ]);
  var targetLines = slData.rows.filter(function(row) {
    return coreCustomerFrontendValue(row[slData.indexes.SHIPMENT_ID]) === shipmentId;
  });

  // ── 4. オーダー明細（このオーダーの分をID→行でインデックス化）──────────
  var olData = coreCustomerFrontendReadTable(ss, 'ORDER_LINES', [
    'ORDER_LINE_ID', 'ORDER_ID', 'PRODUCT_NAME', 'SKU', 'UNIT_PRICE'
  ]);
  var olById = {};
  olData.rows.forEach(function(row) {
    if (coreCustomerFrontendValue(row[olData.indexes.ORDER_ID]) !== orderId) return;
    var olId = coreCustomerFrontendValue(row[olData.indexes.ORDER_LINE_ID]);
    if (olId) olById[olId] = row;
  });

  // ── 5. 配送先マスタ ──────────────────────────────────────────────────────
  var sdData = coreCustomerFrontendReadTable(ss, 'SHIPPING_DESTINATIONS', [
    'SHIPPING_DESTINATION_ID', 'RECIPIENT_NAME',
    'ADDRESS_LINE_1', 'ADDRESS_LINE_2', 'ADDRESS_LINE_3',
    'CITY', 'STATE', 'ZIP', 'COUNTRY', 'PHONE', 'EMAIL'
  ]);
  var sdRow = null;
  for (var di = 0; di < sdData.rows.length; di++) {
    if (coreCustomerFrontendValue(sdData.rows[di][sdData.indexes.SHIPPING_DESTINATION_ID]) === shippingDestinationId) {
      sdRow = sdData.rows[di];
      break;
    }
  }

  // ── 6. 国マスタ（ISO2コード → 英語国名）──────────────────────────────────
  var countryData = coreCustomerFrontendReadTable(ss, 'COUNTRIES', ['COUNTRY_CODE', 'DISPLAY_NAME']);
  var countryNameByCode = {};
  countryData.rows.forEach(function(row) {
    var code = coreCustomerFrontendValue(row[countryData.indexes.COUNTRY_CODE]);
    var name = coreCustomerFrontendValue(row[countryData.indexes.DISPLAY_NAME]);
    if (code) countryNameByCode[code.toUpperCase()] = name;
  });

  // ── 7. HTSコードマスタ（ID → コード）──────────────────────────────────────
  var htsData = coreCustomerFrontendReadTable(ss, 'HTS_CODES', ['HTS_CODE_ID', 'HTS_CODE']);
  var htsByCodeId = {};
  htsData.rows.forEach(function(row) {
    var id   = coreCustomerFrontendValue(row[htsData.indexes.HTS_CODE_ID]);
    var code = coreCustomerFrontendValue(row[htsData.indexes.HTS_CODE]);
    if (id) htsByCodeId[id] = code;
  });

  // ── 8. 顧客税務番号（このcustomer の有効レコードを TYPE_ID でインデックス化）
  var taxData = coreCustomerFrontendReadTable(ss, 'CUSTOMER_TAX_NUMBERS', [
    'CUSTOMER_ID', 'TYPE_ID', 'NUMBER', 'ACTIVE'
  ]);
  var taxByTypeId = {};
  taxData.rows.forEach(function(row) {
    if (coreCustomerFrontendValue(row[taxData.indexes.CUSTOMER_ID]) !== customerId) return;
    if (!elogiIsActive_(row[taxData.indexes.ACTIVE])) return;
    var typeId = coreCustomerFrontendValue(row[taxData.indexes.TYPE_ID]);
    var number = coreCustomerFrontendValue(row[taxData.indexes.NUMBER]);
    if (typeId && number) taxByTypeId[typeId] = number;
  });

  // ── 配送先フィールド解決 ────────────────────────────────────────────────
  var recipientName   = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.RECIPIENT_NAME])   : '';
  var phone           = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.PHONE])            : '';
  var email           = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.EMAIL])            : '';
  var destCountryCode = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.COUNTRY]).toUpperCase() : '';
  var destCountryName = destCountryCode ? (countryNameByCode[destCountryCode] || '') : '';
  var state           = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.STATE])            : '';
  var city            = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.CITY])             : '';
  var zip             = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.ZIP])              : '';
  var address1        = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.ADDRESS_LINE_1])   : '';
  var address2        = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.ADDRESS_LINE_2])   : '';
  var address3        = sdRow ? coreCustomerFrontendValue(sdRow[sdData.indexes.ADDRESS_LINE_3])   : '';

  // 列23: 仕向国に応じた税務番号
  var taxNumberCol23  = elogiResolveTaxId_(destCountryCode, taxByTypeId);
  // 列25: EORI番号
  var eoriNumber      = taxByTypeId['EORI'] || '';

  // ── CSV 生成 ────────────────────────────────────────────────────────────
  var warnings = [];
  var csvDataRows = [];

  for (var li = 0; li < targetLines.length; li++) {
    var line   = targetLines[li];
    var lineNo = li + 1;

    var orderLineId  = coreCustomerFrontendValue(line[slData.indexes.ORDER_LINE_ID]);
    var olRow        = orderLineId ? (olById[orderLineId] || null) : null;

    var sku          = olRow ? coreCustomerFrontendValue(olRow[olData.indexes.SKU])           : '';
    var productTitle = olRow ? coreCustomerFrontendValue(olRow[olData.indexes.PRODUCT_NAME]) : '';
    var unitPriceRaw = olRow ? olRow[olData.indexes.UNIT_PRICE]                              : null;
    var unitPrice    = typeof unitPriceRaw === 'number'
      ? unitPriceRaw
      : parseFloat(String(unitPriceRaw || '').replace(/,/g, '')) || 0;

    var quantityRaw  = line[slData.indexes.QUANTITY];
    var quantity     = typeof quantityRaw === 'number'
      ? String(quantityRaw)
      : coreCustomerFrontendValue(quantityRaw);

    // USD 申告単価 = 単価（現地通貨） ÷ 為替レート（現地通貨→JPY）
    // 単価は JPY 建て前提のため、JPY/exchangeRate = USD
    var usdUnitPrice = '';
    if (unitPrice > 0 && exchangeRate > 0) {
      usdUnitPrice = (unitPrice / exchangeRate).toFixed(2);
    }

    var htsCodeId       = coreCustomerFrontendValue(line[slData.indexes.HTS_CODE_ID]);
    var htsCode         = htsCodeId ? (htsByCodeId[htsCodeId] || '') : '';

    var originCode      = coreCustomerFrontendValue(line[slData.indexes.ORIGIN_COUNTRY]).toUpperCase();
    var originName      = originCode ? (countryNameByCode[originCode] || '') : '';

    // 必須項目チェック（空 = 警告、エラーにはしない）
    var requiredFields = [
      { field: 'ORDER_SOURCE',   value: orderSource    },
      { field: 'ORDER_DATE',     value: orderDate      },
      { field: 'PRODUCT_TITLE',  value: productTitle   },
      { field: 'QUANTITY',       value: quantity        },
      { field: 'USD_UNIT_PRICE', value: usdUnitPrice   },
      { field: 'RECIPIENT_NAME', value: recipientName  },
      { field: 'PHONE',          value: phone           },
      { field: 'DEST_COUNTRY',   value: destCountryName },
      { field: 'CITY',           value: city            },
      { field: 'ADDRESS_LINE_1', value: address1        }
    ];
    requiredFields.forEach(function(check) {
      if (!check.value) {
        warnings.push({ lineNo: lineNo, field: check.field, reason: 'REQUIRED_FIELD_EMPTY' });
      }
    });

    var cells = [
      orderSource,      // 1  注文種類
      orderId,          // 2  注文番号
      orderDate,        // 3  注文日
      sku,              // 4  SKU
      '',               // 5  商品画像URL（対応外）
      productTitle,     // 6  商品タイトル
      quantity,         // 7  数量
      usdUnitPrice,     // 8  USD申告単価/個
      '',               // 9  購入者ID（対応外）
      recipientName,    // 10 受取人氏名
      '',               // 11 受取人会社名（配送先マスタに列なし）
      phone,            // 12 電話番号
      email,            // 13 メールアドレス
      destCountryName,  // 14 国名（英語）
      state,            // 15 州コード/州名
      city,             // 16 市
      zip,              // 17 郵便番号
      address1,         // 18 住所１
      address2,         // 19 住所２
      address3,         // 20 住所３
      htsCode,          // 21 HS/HTSコード
      originName,       // 22 原産国（英語）
      taxNumberCol23,   // 23 受取人 納税者ID
      '',               // 24 事前徴収ID（対応外）
      eoriNumber        // 25 EORI番号
    ];

    csvDataRows.push(cells.map(elogiCsvCell_).join(','));
  }

  var headerLine = ELOGI_CSV_HEADERS.map(elogiCsvCell_).join(',');
  var csv = [headerLine].concat(csvDataRows).join('\n');

  return { csv: csv, warnings: warnings };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * 仕向国コードに応じた税務番号（列23）を選択する。
 * US → US_TAX_ID、KR → PCCC、MX → RFC、
 * 該当なし → TAX_ID があればそれ、なければ空。
 *
 * @param {string} destCountryCode - ISO2 国コード（大文字）
 * @param {Object} taxByTypeId     - { typeId: number } のマップ
 * @returns {string}
 */
function elogiResolveTaxId_(destCountryCode, taxByTypeId) {
  var preferredTypeId = ELOGI_TAX_ID_COUNTRY_MAP[destCountryCode];
  if (preferredTypeId && taxByTypeId[preferredTypeId]) {
    return taxByTypeId[preferredTypeId];
  }
  return taxByTypeId['TAX_ID'] || '';
}

/**
 * Date オブジェクトを yyyy/mm/dd 形式に変換する。
 * Date 以外 / 無効日付 は '' を返す。
 *
 * @param {*} value
 * @returns {string}
 */
function elogiFormatDate_(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return '';
  var y = value.getFullYear();
  var m = value.getMonth() + 1;
  var d = value.getDate();
  return y + '/' + (m < 10 ? '0' + m : m) + '/' + (d < 10 ? '0' + d : d);
}

/**
 * CSV セルのエスケープ。
 * カンマ・改行・引用符を含む場合は二重引用符で囲む（RFC 4180 準拠）。
 *
 * @param {*} value
 * @returns {string}
 */
function elogiCsvCell_(value) {
  var str = (value === null || value === undefined) ? '' : String(value);
  if (str.indexOf(',') !== -1 || str.indexOf('\n') !== -1 ||
      str.indexOf('\r') !== -1 || str.indexOf('"') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * ACTIVE 列の値を boolean として評価する。
 * GAS の getValues() は boolean セルを true/false で返す。
 *
 * @param {*} value
 * @returns {boolean}
 */
function elogiIsActive_(value) {
  if (typeof value === 'boolean') return value;
  var str = String(value || '').trim().toUpperCase();
  return str === 'TRUE' || str === '1' || str === '有効' || str === '○';
}

// ─── DEV テストラッパー ──────────────────────────────────────────────────────

/**
 * DEV 環境専用: eLogi CSV 生成を clasp run で検証するラッパー。
 * セッションを自動生成して generateElogiCsvForFrontend を呼び出す。
 *
 * ★ 顧客名・住所・金額はログに出力しない。
 *   報告するのは列数・行数・warnings のみ。
 *
 * @param {string} shipmentId - 対象の発送ID（例: "SH-0004"）
 * @returns {Object} { shipmentId, headerColumnCount, dataRowCount, warningCount, warningFields }
 */
function devTestElogiCsv(shipmentId) {
  if (getEnvironment() !== 'development') {
    throw new Error('devTestElogiCsv は development 環境でのみ実行できます。');
  }
  if (!shipmentId) throw new Error('shipmentId を指定してください（例: "SH-0004"）');

  // 有効なスタッフのセッションを作成
  var ss          = getSpreadsheet();
  var staffTable  = getCoreSchemaV1Table('STAFF');
  var staffSheet  = getCoreSchemaV1Sheet(ss, 'STAFF');
  var staffLastCol = staffSheet.getLastColumn();
  var staffHeaders = staffSheet
    .getRange(staffTable.headerRowNumber, 1, 1, staffLastCol)
    .getDisplayValues()[0].map(function(h) { return String(h).trim(); });

  var staffIdIdx     = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STAFF_ID'));
  var staffStatusIdx = staffHeaders.indexOf(getCoreSchemaV1HeaderName('STAFF', 'STATUS'));
  var staffLastRow   = staffSheet.getLastRow();
  var staffRows      = staffLastRow > staffTable.headerRowNumber
    ? staffSheet.getRange(staffTable.headerRowNumber + 1, 1,
        staffLastRow - staffTable.headerRowNumber, staffLastCol).getValues()
    : [];

  var activeStatus = getCoreSchemaV1Value('STAFF', 'STATUS', 'ACTIVE');
  var staffId = null;
  for (var i = 0; i < staffRows.length; i++) {
    var status = String(staffRows[i][staffStatusIdx] || '').trim();
    if (status === activeStatus) {
      var sid = String(staffRows[i][staffIdIdx] || '').trim();
      if (sid) { staffId = sid; break; }
    }
  }
  if (!staffId) throw new Error('NO_ACTIVE_STAFF_FOUND');

  var sessionId = createSession(staffId);
  var result;
  try {
    result = generateElogiCsvForFrontend(sessionId, shipmentId);
  } finally {
    revokeSession(sessionId);
  }

  // CSV を解析して列数・行数を確認（内容は返さない）
  var lines = result.csv.split('\n');
  var headerLine  = lines[0] || '';
  var headerCols  = headerLine.split(',').length;
  var dataRowCount = lines.length - 1;

  // warnings は field と reason のみ返す（値は含まない）
  var warningFields = result.warnings.map(function(w) {
    return { lineNo: w.lineNo, field: w.field, reason: w.reason };
  });

  Logger.log('=== devTestElogiCsv(' + shipmentId + ') ===');
  Logger.log('ヘッダー列数: ' + headerCols);
  Logger.log('データ行数:   ' + dataRowCount);
  Logger.log('warnings 件数: ' + warningFields.length);
  warningFields.forEach(function(w) {
    Logger.log('  [line ' + w.lineNo + '] ' + w.field + ': ' + w.reason);
  });

  return {
    shipmentId:        shipmentId,
    headerColumnCount: headerCols,
    dataRowCount:      dataRowCount,
    warningCount:      warningFields.length,
    warningFields:     warningFields
  };
}
