/**
 * 99_DevBoxBuilderTest.js
 *
 * 目的: buildBoxesFromLines_ を DEV 環境でセッションなしにテストする。
 *       estimateShippingFeeForOrderForFrontend / estimateShippingFeeForQuoteForFrontend
 *       はセッション認証を要するため、箱組み立て部分のみを直接検証する。
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - シートへの書き込み（読み取り専用）
 *
 * 使い方:
 *   clasp run devTestBuildBoxesFromOrderLines --params '["<orderId>"]'
 *   clasp run devTestBuildBoxesFromQuoteLines --params '["<quoteId>"]'
 */

/**
 * 指定した受注の明細から箱を組み立てるテスト（セッション不要）。
 *
 * @param {string} orderId
 * @returns {{ orderId: string, lineCount: number, boxes: number, skipped: Array }}
 */
function devTestBuildBoxesFromOrderLines(orderId) {
  if (getEnvironment() !== 'development') {
    throw new Error('devTestBuildBoxesFromOrderLines は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();

  // ORDER_LINES を直接読み込む（セッション不要）
  var linesData = coreCustomerFrontendReadTable(ss, 'ORDER_LINES', [
    'ORDER_ID', 'PRODUCT_ID', 'QUANTITY', 'CONDITION'
  ]);

  var rawLines = linesData.rows
    .filter(function(r) {
      return coreCustomerFrontendValue(r[linesData.indexes.ORDER_ID]) === orderId;
    })
    .map(function(r) {
      return {
        productId: coreCustomerFrontendValue(r[linesData.indexes.PRODUCT_ID]),
        quantity:  Number(coreCustomerFrontendValue(r[linesData.indexes.QUANTITY])) || 0,
        condition: coreCustomerFrontendValue(r[linesData.indexes.CONDITION])
      };
    });

  var built = buildBoxesFromLines_(rawLines, ss);

  return {
    orderId:   orderId,
    lineCount: rawLines.length,
    boxCount:  built.boxes.length,
    skipped:   built.skipped
  };
}

/**
 * 指定した見積もりの明細から箱を組み立てるテスト（セッション不要）。
 *
 * @param {string} quoteId
 * @returns {{ quoteId: string, lineCount: number, boxes: number, skipped: Array }}
 */
function devTestBuildBoxesFromQuoteLines(quoteId) {
  if (getEnvironment() !== 'development') {
    throw new Error('devTestBuildBoxesFromQuoteLines は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();

  // QUOTE_LINES を直接読み込む（セッション不要・CONDITION は '状態' 列）
  var linesData = coreCustomerFrontendReadTable(ss, 'QUOTE_LINES', [
    'QUOTE_ID', 'PRODUCT_ID', 'QUANTITY', 'CONDITION'
  ]);

  var rawLines = linesData.rows
    .filter(function(r) {
      return coreCustomerFrontendValue(r[linesData.indexes.QUOTE_ID]) === quoteId;
    })
    .map(function(r) {
      return {
        productId: coreCustomerFrontendValue(r[linesData.indexes.PRODUCT_ID]),
        quantity:  Number(coreCustomerFrontendValue(r[linesData.indexes.QUANTITY])) || 0,
        condition: coreCustomerFrontendValue(r[linesData.indexes.CONDITION])
      };
    });

  var built = buildBoxesFromLines_(rawLines, ss);

  return {
    quoteId:   quoteId,
    lineCount: rawLines.length,
    boxCount:  built.boxes.length,
    skipped:   built.skipped
  };
}

/**
 * DEV 環境の ORDER_LINES と QUOTE_LINES に存在するIDを列挙する（ID探索用）。
 *
 * @returns {{ orderIds: string[], quoteIds: string[] }}
 */
function devListExistingLineIds() {
  if (getEnvironment() !== 'development') {
    throw new Error('devListExistingLineIds は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();

  var orderData = coreCustomerFrontendReadTable(ss, 'ORDER_LINES', ['ORDER_ID']);
  var orderIds = [];
  orderData.rows.forEach(function(r) {
    var id = coreCustomerFrontendValue(r[orderData.indexes.ORDER_ID]);
    if (id && orderIds.indexOf(id) === -1) orderIds.push(id);
  });

  var quoteData = coreCustomerFrontendReadTable(ss, 'QUOTE_LINES', ['QUOTE_ID']);
  var quoteIds = [];
  quoteData.rows.forEach(function(r) {
    var id = coreCustomerFrontendValue(r[quoteData.indexes.QUOTE_ID]);
    if (id && quoteIds.indexOf(id) === -1) quoteIds.push(id);
  });

  return { orderIds: orderIds, quoteIds: quoteIds };
}
