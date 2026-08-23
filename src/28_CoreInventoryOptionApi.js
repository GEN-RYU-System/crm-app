/**
 * 在庫連動見積もり明細 オプションAPI
 *
 * getInventoryProductOptions  … 在庫のある商品候補一覧
 * getInventoryConditions       … 指定商品の在庫のある状態一覧（後方互換用に残存）
 */

var INVENTORY_PRODUCT_OPTIONS_CACHE_INDEX  = 'INVENTORY_PRODUCT_OPTIONS_CACHE_INDEX_V2';
var INVENTORY_PRODUCT_OPTIONS_CACHE_PREFIX = 'INVENTORY_PRODUCT_OPTIONS_CACHE_V2_';
var INVENTORY_PRODUCT_OPTIONS_CACHE_TTL    = 600;
var INVENTORY_PRODUCT_OPTIONS_CACHE_CHUNK  = 90000;

/**
 * 在庫のある商品の候補一覧を返す。
 * 共用在庫に Quantity > 0 の行が1件以上ある商品のみ。
 * 商品名は商品マスタ同期の Japanese Title を使う。
 *
 * @param {string} sessionId
 * @returns {{ productId: string, productName: string, category: string }[]}
 */
function getInventoryProductOptions(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('lead_view');

  var cached = readCacheChunks_(
    INVENTORY_PRODUCT_OPTIONS_CACHE_INDEX,
    INVENTORY_PRODUCT_OPTIONS_CACHE_PREFIX
  );
  if (cached !== null) return cached;

  var ss         = getSpreadsheet();
  var invSchema  = CORE_SCHEMA_V1_TABLES['SHARED_INVENTORY'];
  var prodSchema = CORE_SCHEMA_V1_TABLES['PRODUCTS'];

  var invSheet = ss.getSheetByName(invSchema.sheetName);
  if (!invSheet || invSheet.getLastRow() <= 1) return [];

  var invData  = invSheet.getDataRange().getValues();
  var invH     = invData[0].map(String);
  var pidIdx   = invH.indexOf(invSchema.headers['PRODUCT_ID']);
  var qtyIdx   = invH.indexOf(invSchema.headers['QUANTITY']);
  if (pidIdx < 0 || qtyIdx < 0) {
    throw new Error('共用在庫ヘッダー不足: PRODUCT_ID / QUANTITY');
  }

  var prodSheet = ss.getSheetByName(prodSchema.sheetName);
  if (!prodSheet || prodSheet.getLastRow() <= 1) return [];

  var prodData    = prodSheet.getDataRange().getValues();
  var prodH       = prodData[0].map(String);
  var prodPidIdx  = prodH.indexOf(prodSchema.headers['PRODUCT_ID']);
  var jaIdx       = prodH.indexOf(prodSchema.headers['JAPANESE_TITLE']);
  var catIdx      = prodH.indexOf(prodSchema.headers['CATEGORY']);
  if (prodPidIdx < 0 || jaIdx < 0) {
    throw new Error('商品マスタ同期ヘッダー不足: product_id / Japanese Title');
  }

  // 商品マスタをマップ化（pid → meta）
  var prodMap = {};
  for (var pi = 1; pi < prodData.length; pi++) {
    var ppid = String(prodData[pi][prodPidIdx] != null ? prodData[pi][prodPidIdx] : '').trim();
    if (!ppid) continue;
    prodMap[ppid] = {
      productName: String(prodData[pi][jaIdx]  != null ? prodData[pi][jaIdx]  : '').trim(),
      category:    catIdx >= 0 ? String(prodData[pi][catIdx] != null ? prodData[pi][catIdx] : '').trim() : ''
    };
  }

  // 在庫あり商品IDを収集（QUANTITY > 0 のみ）
  var hasCond = {};
  for (var i = 1; i < invData.length; i++) {
    var qty = Number(invData[i][qtyIdx]) || 0;
    if (qty <= 0) continue;
    var pid = String(invData[i][pidIdx] != null ? invData[i][pidIdx] : '').trim();
    if (!pid || !prodMap[pid]) continue;
    hasCond[pid] = true;
  }

  // PRODUCTS の行順を維持して結果を組み立て
  var results = [];
  for (var j = 1; j < prodData.length; j++) {
    var pid2 = String(prodData[j][prodPidIdx] != null ? prodData[j][prodPidIdx] : '').trim();
    if (!pid2 || !hasCond[pid2]) continue;
    var p = prodMap[pid2];
    results.push({
      productId:   pid2,
      productName: p.productName,
      category:    p.category
    });
  }

  writeCacheChunks_(
    INVENTORY_PRODUCT_OPTIONS_CACHE_INDEX,
    INVENTORY_PRODUCT_OPTIONS_CACHE_PREFIX,
    results,
    INVENTORY_PRODUCT_OPTIONS_CACHE_TTL,
    INVENTORY_PRODUCT_OPTIONS_CACHE_CHUNK
  );

  return results;
}

/**
 * 指定商品の、在庫のある状態の一覧を返す。
 * Quantity が 0 の行は除外。
 * unitWeight: Condition === 'Case' → Case重量、それ以外 → Box重量（取得不可の場合 0）
 * ※ 個別商品の状態詳細を取得する用途で残存させる。
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
