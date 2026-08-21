/**
 * 在庫連動見積もり明細 オプションAPI
 *
 * getInventoryProductOptions  … 在庫のある商品候補一覧
 * getInventoryConditions       … 指定商品の在庫のある状態一覧
 */

/**
 * 在庫のある商品の候補一覧を返す。
 * 共用在庫に Quantity > 0 の行が1件以上ある商品のみ。
 * 商品名は商品マスタ同期の Japanese Title を使う。
 *
 * @param {string} sessionId
 * @returns {{ productId: string, productName: string }[]}
 */
function getInventoryProductOptions(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var ss        = getSpreadsheet();
  var invSchema = CORE_SCHEMA_V1_TABLES['SHARED_INVENTORY'];

  var invSheet = ss.getSheetByName(invSchema.sheetName);
  if (!invSheet || invSheet.getLastRow() <= 1) return [];

  var invData  = invSheet.getDataRange().getValues();
  var invH     = invData[0].map(String);
  var pidIdx   = invH.indexOf(invSchema.headers['PRODUCT_ID']);
  var qtyIdx   = invH.indexOf(invSchema.headers['QUANTITY']);
  if (pidIdx < 0 || qtyIdx < 0) throw new Error('共用在庫ヘッダー不足: PRODUCT_ID / QUANTITY');

  // Collect unique product_ids with Quantity > 0
  var seenIds = {};
  for (var i = 1; i < invData.length; i++) {
    var qty = Number(invData[i][qtyIdx]) || 0;
    if (qty <= 0) continue;
    var pid = String(invData[i][pidIdx] != null ? invData[i][pidIdx] : '').trim();
    if (pid) seenIds[pid] = true;
  }

  // Join to 商品マスタ同期 to get Japanese Title
  var prodSchema = CORE_SCHEMA_V1_TABLES['PRODUCTS'];
  var prodSheet  = ss.getSheetByName(prodSchema.sheetName);
  if (!prodSheet || prodSheet.getLastRow() <= 1) return [];

  var prodData    = prodSheet.getDataRange().getValues();
  var prodH       = prodData[0].map(String);
  var prodPidIdx  = prodH.indexOf(prodSchema.headers['PRODUCT_ID']);
  var jaIdx       = prodH.indexOf(prodSchema.headers['JAPANESE_TITLE']);
  var catIdx      = prodH.indexOf(prodSchema.headers['CATEGORY']);
  if (prodPidIdx < 0 || jaIdx < 0) throw new Error('商品マスタ同期ヘッダー不足: product_id / Japanese Title');

  var results = [];
  for (var j = 1; j < prodData.length; j++) {
    var pid2 = String(prodData[j][prodPidIdx] != null ? prodData[j][prodPidIdx] : '').trim();
    if (!pid2 || !seenIds[pid2]) continue;
    var jaTitle  = String(prodData[j][jaIdx]  != null ? prodData[j][jaIdx]  : '').trim();
    var category = catIdx >= 0 ? String(prodData[j][catIdx] != null ? prodData[j][catIdx] : '').trim() : '';
    results.push({ productId: pid2, productName: jaTitle, category: category });
  }
  return results;
}

/**
 * 指定商品の、在庫のある状態の一覧を返す。
 * Quantity が 0 の行は除外。
 * unitWeight: Condition === 'Case' → Case重量、それ以外 → Box重量（取得不可の場合 0）
 *
 * @param {string} sessionId
 * @param {string} productId
 * @returns {{ condition: string, quantity: number, unitPrice: number, unitWeight: number }[]}
 */
function getInventoryConditions(sessionId, productId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  if (!productId) throw new Error('productId is required');

  var ss        = getSpreadsheet();
  var invSchema = CORE_SCHEMA_V1_TABLES['SHARED_INVENTORY'];
  var CONDITION_CASE = invSchema.values.CONDITION.CASE;

  var invSheet = ss.getSheetByName(invSchema.sheetName);
  if (!invSheet || invSheet.getLastRow() <= 1) return [];

  var invData  = invSheet.getDataRange().getValues();
  var invH     = invData[0].map(String);
  var pidIdx   = invH.indexOf(invSchema.headers['PRODUCT_ID']);
  var qtyIdx   = invH.indexOf(invSchema.headers['QUANTITY']);
  var priceIdx = invH.indexOf(invSchema.headers['UNIT_PRICE']);
  var condIdx  = invH.indexOf(invSchema.headers['CONDITION']);
  if (pidIdx < 0 || qtyIdx < 0 || priceIdx < 0 || condIdx < 0) {
    throw new Error('共用在庫ヘッダー不足');
  }

  // Get weight data from 商品マスタ同期
  var prodSchema    = CORE_SCHEMA_V1_TABLES['PRODUCTS'];
  var prodSheet     = ss.getSheetByName(prodSchema.sheetName);
  var boxWeight     = 0;
  var caseWeight    = 0;
  if (prodSheet && prodSheet.getLastRow() > 1) {
    var prodData      = prodSheet.getDataRange().getValues();
    var prodH         = prodData[0].map(String);
    var prodPidIdx    = prodH.indexOf(prodSchema.headers['PRODUCT_ID']);
    var boxWeightIdx  = prodH.indexOf(prodSchema.headers['BOX_WEIGHT']);
    var caseWeightIdx = prodH.indexOf(prodSchema.headers['CASE_WEIGHT']);
    if (prodPidIdx >= 0 && boxWeightIdx >= 0 && caseWeightIdx >= 0) {
      for (var pi = 1; pi < prodData.length; pi++) {
        var ppid = String(prodData[pi][prodPidIdx] != null ? prodData[pi][prodPidIdx] : '').trim();
        if (ppid === productId) {
          boxWeight  = Number(prodData[pi][boxWeightIdx])  || 0;
          caseWeight = Number(prodData[pi][caseWeightIdx]) || 0;
          break;
        }
      }
    }
  }

  // Filter rows for this product with Quantity > 0
  var rows = [];
  for (var i = 1; i < invData.length; i++) {
    var pid = String(invData[i][pidIdx] != null ? invData[i][pidIdx] : '').trim();
    if (pid !== productId) continue;
    var qty = Number(invData[i][qtyIdx]) || 0;
    if (qty <= 0) continue;
    var condition  = String(invData[i][condIdx] != null ? invData[i][condIdx] : '');
    var unitPrice  = Number(invData[i][priceIdx]) || 0;
    var unitWeight = (condition === CONDITION_CASE) ? caseWeight : boxWeight;
    rows.push({ condition: condition, quantity: qty, unitPrice: unitPrice, unitWeight: unitWeight });
  }
  return rows;
}
