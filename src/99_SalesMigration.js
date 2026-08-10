/**
 * 99_SalesMigration.gs — 売上データ → オーダー管理/明細 移行スクリプト
 *
 * エントリポイント: migrateSalesData(mode)
 *   mode='DRY_RUN' : 書き込みなし・全報告
 *   mode='CONFIRM' : 未実装（DRY_RUN確認後に実装）
 */

// ============================================================
// 列インデックス定数 (0-based, specのcol番号-1)
// ============================================================
var SALES_COL = {
  STATUS:      0,  // col1:  ステータス
  NAME:        5,  // col6:  取引先名
  CATEGORY:    6,  // col7:  カテゴリ
  PROD_NAME:   7,  // col8:  商品名
  CONDITION:   8,  // col9:  状態
  INV_CONT:    9,  // col10: 請求書内容
  QTY:        10,  // col11: 数量
  INV_NO:     11,  // col12: 請求書番号
  INV_LINK:   12,  // col13: 請求書リンク
  COL14:      13,  // col14: 合計（監査専用・通常空欄）
  UNIT_PRICE: 14,  // col15: 単価
  SUBTOTAL:   15,  // col16: 小計（元データ・検証用）
  CUSTOMS:    16,  // col17: 関税
  SHIPPING:   17,  // col18: 送料
  PAYMENT:    18,  // col19: 決済手段
  CURRENCY:   19,  // col20: 通貨
  SKU:        20,  // col21: SKU
  INV_DATE:   22,  // col23: 請求書発行日
  DUE_DATE:   23,  // col24: 支払期日
  PAY_CONF:   24,  // col25: 支払確認日
  RATE:       25,  // col26: 為替レート
  SHIP_METHOD:77,  // col78: 発送方法
  SHIP_DATE:  78,  // col79: 発送日
  TRACKING:   79,  // col80: 運送状番号
  SHIP_MEMO:  85   // col86: 発送時メモ
};

// 名寄せ例外表（本人確定済み）
var SALES_NAME_EXCEPTIONS = {
  'Card Galaxy LTD':   'CT-00006',
  'Grapecat boosters': 'CT-00025'
};

// オーダー内フィールド一致チェック対象
var SALES_CONSISTENCY_COLS = [
  { c: SALES_COL.CURRENCY,    label: '通貨' },
  { c: SALES_COL.INV_DATE,    label: '請求書発行日' },
  { c: SALES_COL.DUE_DATE,    label: '支払期日' },
  { c: SALES_COL.PAY_CONF,    label: '支払確認日' },
  { c: SALES_COL.SHIP_DATE,   label: '発送日' },
  { c: SALES_COL.TRACKING,    label: '運送状番号' },
  { c: SALES_COL.SHIP_METHOD, label: '発送方法' },
  { c: SALES_COL.INV_LINK,    label: '請求書リンク' }
];

/**
 * メインエントリ
 */
function migrateSalesData(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'CONFIRM') {
    return 'ERROR: mode は "DRY_RUN" または "CONFIRM" を指定してください';
  }
  if (mode === 'CONFIRM') {
    return 'ERROR: CONFIRM は未実装。DRY_RUN で内容確認後に実装します';
  }

  var ss  = getSpreadsheet();
  var out = ['=== migrateSalesData(DRY_RUN) ==='];
  var anomalies = [];

  // ============================================================
  // 参照データ読み込み
  // ============================================================
  var custSh  = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  var custAll = custSh.getDataRange().getValues();
  var cH = custAll[0];
  var cHId  = cH.indexOf('顧客ID');
  var cHNm  = cH.indexOf('顧客名');
  var cHSrc = cH.indexOf('源流リードID');
  var nameToCtId = {}, ctToSrc = {};
  for (var ci = 1; ci < custAll.length; ci++) {
    var cn = String(custAll[ci][cHNm]  || '').trim();
    var cd = String(custAll[ci][cHId]  || '').trim();
    var cs = String(custAll[ci][cHSrc] || '').trim();
    if (cn) nameToCtId[cn] = cd;
    if (cd) ctToSrc[cd] = cs;
  }

  var shipSh  = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  var shipAll = shipSh.getDataRange().getValues();
  var sH = shipAll[0];
  var sHAd = sH.indexOf('配送先ID'), sHCt = sH.indexOf('顧客ID'), sHDef = sH.indexOf('既定');
  var shipByCt = {};
  for (var si = 1; si < shipAll.length; si++) {
    var sct = String(shipAll[si][sHCt] || '').trim();
    if (!sct) continue;
    if (!shipByCt[sct]) shipByCt[sct] = [];
    shipByCt[sct].push({ adId: String(shipAll[si][sHAd] || '').trim(), isDef: shipAll[si][sHDef] });
  }

  var paySh  = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
  var payAll = paySh.getDataRange().getValues();
  var pH = payAll[0];
  var pHPy = pH.indexOf('支払先ID'), pHCt = pH.indexOf('顧客ID'), pHDef = pH.indexOf('既定');
  var payByCt = {};
  for (var pi = 1; pi < payAll.length; pi++) {
    var pct = String(payAll[pi][pHCt] || '').trim();
    if (!pct) continue;
    if (!payByCt[pct]) payByCt[pct] = [];
    payByCt[pct].push({ pyId: String(payAll[pi][pHPy] || '').trim(), isDef: payAll[pi][pHDef] });
  }

  // ============================================================
  // 売上データ読み込み
  // ============================================================
  var salesSh  = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  var lastCol  = salesSh.getLastColumn();
  var lastRow  = salesSh.getLastRow();
  var DATA_START = 61;
  var numRows  = lastRow - DATA_START + 1;
  var rawData  = salesSh.getRange(DATA_START, 1, numRows, lastCol).getValues();

  // ============================================================
  // ヘルパー関数
  // ============================================================
  var fmtD = function(v) {
    if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd');
    return String(v || '').trim();
  };
  var fmtDKey = function(v) {
    if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyyMMdd');
    return String(v || '').trim();
  };
  // 末尾の -数字 を除いた基番号（例: "#0914-03" → "#0914"）
  var baseInvNo = function(invNo) {
    return invNo.replace(/-\d+$/, '');
  };
  var resolveCtId = function(name) {
    if (SALES_NAME_EXCEPTIONS[name] !== undefined) return SALES_NAME_EXCEPTIONS[name];
    return nameToCtId[name] !== undefined ? nameToCtId[name] : null;
  };
  var normCurr = function(v) {
    var s = String(v || '').trim();
    if (s === '')            return { val: '',    ok: true };
    if (s === 'JPY' || s === '日本円') return { val: 'JPY', ok: true };
    return { val: s, ok: false };
  };
  var defAd = function(ctId) {
    var list = (shipByCt[ctId] || []).filter(function(e) { return e.isDef === true; });
    if (list.length === 1) return { id: list[0].adId, err: null };
    if (list.length === 0) return { id: '', err: '既定=TRUEの配送先なし' };
    return { id: '', err: '既定=TRUE複数: ' + list.map(function(e) { return e.adId; }).join(',') };
  };
  var defPy = function(ctId) {
    var list = (payByCt[ctId] || []).filter(function(e) { return e.isDef === true; });
    if (list.length === 1) return { id: list[0].pyId, err: null };
    if (list.length === 0) return { id: '', err: '既定=TRUEの支払先なし' };
    return { id: '', err: '既定=TRUE複数: ' + list.map(function(e) { return e.pyId; }).join(',') };
  };

  // ============================================================
  // フィルタリング
  // ============================================================
  var exA = [], exB = [], exC = [], exD = [];
  var included = [];

  rawData.forEach(function(row, idx) {
    var sr     = DATA_START + idx;
    var status = String(row[SALES_COL.STATUS] || '').trim();
    var name   = String(row[SALES_COL.NAME]   || '').trim();
    var qty    = row[SALES_COL.QTY];
    var price  = row[SALES_COL.UNIT_PRICE];

    if (status === '仕入れ')                        { exB.push(sr); return; }
    if (name === 'AKS Holding Ltd - FAO: LUKY')     { exC.push(sr); return; }
    if (name.indexOf('支払い太郎') === 0)            { exD.push(sr); return; }
    var nameEm  = (name  === '');
    var qtyEm   = (qty   === '' || qty   === null || qty   === undefined);
    var priceEm = (price === '' || price === null || price === undefined);
    if (nameEm && qtyEm && priceEm)                 { exA.push(sr); return; }

    included.push({ row: row, sr: sr });
  });

  // ============================================================
  // グループ化
  // ============================================================
  var orderMap = {}, orderKeys = [];
  included.forEach(function(item) {
    var row      = item.row;
    var invNo    = String(row[SALES_COL.INV_NO]   || '').trim();
    var name     = String(row[SALES_COL.NAME]      || '').trim();
    var tracking = String(row[SALES_COL.TRACKING]  || '').trim();
    var shipDs   = fmtDKey(row[SALES_COL.SHIP_DATE]);
    var key;
    if      (invNo    !== '') key = 'INV:' + baseInvNo(invNo);
    else if (tracking !== '') key = 'TRK:' + name + '|' + tracking;
    else if (shipDs   !== '') key = 'DAT:' + name + '|' + shipDs;
    else                      key = 'ROW:' + item.sr;

    if (!orderMap[key]) { orderMap[key] = []; orderKeys.push(key); }
    orderMap[key].push(item);
  });

  // ============================================================
  // オーダー構築
  // ============================================================
  var orders = [], multiOrders = [];
  var odSeq = 1, odlSeq = 1;

  orderKeys.forEach(function(key) {
    var items = orderMap[key];
    var fr    = items[0].row;

    var custName = String(fr[SALES_COL.NAME] || '').trim();
    var ctId     = resolveCtId(custName);
    if (ctId === null) {
      anomalies.push({ type: 'NO_CT', name: custName, key: key,
        rows: items.map(function(i) { return i.sr; }) });
    }

    var adR = ctId ? defAd(ctId) : { id: '', err: '顧客ID未特定' };
    var pyR = ctId ? defPy(ctId) : { id: '', err: '顧客ID未特定' };
    if (adR.err) anomalies.push({ type: 'AD_ERR', ctId: ctId || '?', name: custName, key: key, msg: adR.err });
    if (pyR.err) anomalies.push({ type: 'PY_ERR', ctId: ctId || '?', name: custName, key: key, msg: pyR.err });

    var currRes = normCurr(fr[SALES_COL.CURRENCY]);
    if (!currRes.ok) anomalies.push({ type: 'CURRENCY', key: key, name: custName, val: currRes.val });

    // オーダー内フィールド一致チェック
    if (items.length > 1) {
      SALES_CONSISTENCY_COLS.forEach(function(fc) {
        var first = fmtD(fr[fc.c]);
        var diff  = items.filter(function(it) { return fmtD(it.row[fc.c]) !== first; });
        if (diff.length > 0) {
          anomalies.push({ type: 'INCONSISTENT', key: key, name: custName, field: fc.label,
            detail: 'first='+first+' / 不一致: '+diff.map(function(it){ return 'row'+it.sr+'='+fmtD(it.row[fc.c]); }).join(', ') });
        }
      });
    }

    // 送料・関税 合計
    var totalShip = 0, totalCust = 0;
    items.forEach(function(it) {
      var s = Number(it.row[SALES_COL.SHIPPING] || 0); if (!isNaN(s)) totalShip += s;
      var c = Number(it.row[SALES_COL.CUSTOMS]  || 0); if (!isNaN(c)) totalCust  += c;
    });

    // 明細行
    var lineItems = [], lineTotal = 0;
    items.forEach(function(it, li) {
      var row  = it.row;
      var qty  = Number(row[SALES_COL.QTY]        || 0);
      var prc  = Number(row[SALES_COL.UNIT_PRICE] || 0);
      var calc = qty * prc;

      var origSub = row[SALES_COL.SUBTOTAL];
      if (origSub !== '' && origSub !== null && !isNaN(Number(origSub)) && Number(origSub) !== 0) {
        if (Math.abs(calc - Number(origSub)) > 0.01) {
          anomalies.push({ type: 'SUB_MISMATCH', sr: it.sr, name: custName, key: key,
            qty: qty, prc: prc, calc: calc, orig: Number(origSub) });
        }
      }

      var pname = String(row[SALES_COL.INV_CONT]  || '').trim()
               || String(row[SALES_COL.PROD_NAME] || '').trim();
      lineTotal += calc;
      lineItems.push({
        odlId:    'ODL-' + ('00000' + odlSeq++).slice(-5),
        rowNum:   li + 1,
        category: String(row[SALES_COL.CATEGORY]  || '').trim(),
        name:     pname,
        cond:     String(row[SALES_COL.CONDITION] || '').trim(),
        sku:      String(row[SALES_COL.SKU]        || '').trim(),
        qty:      qty,
        prc:      prc,
        sub:      calc,
        sr:       it.sr
      });
    });

    var grand = lineTotal + totalShip + totalCust;
    var col14s = items
      .map(function(it) { return { sr: it.sr, v: it.row[SALES_COL.COL14] }; })
      .filter(function(x) { return x.v !== '' && x.v !== null && !isNaN(Number(x.v)) && Number(x.v) !== 0; });

    var ord = {
      key: key,  odId: 'OD-' + ('00000' + odSeq++).slice(-5),
      invNo:    baseInvNo(String(fr[SALES_COL.INV_NO] || '').trim()),
      name:     custName,
      ctId:     ctId || '',
      adId:     adR.id,
      pyId:     pyR.id,
      srcLead:  ctId ? (ctToSrc[ctId] || '') : '',
      status:   String(fr[SALES_COL.STATUS]     || '').trim(),
      currency: currRes.val,
      rate:     fr[SALES_COL.RATE],
      lineTotal: lineTotal, ship: totalShip, cust: totalCust, grand: grand,
      payment:    String(fr[SALES_COL.PAYMENT]    || '').trim(),
      invLink:    String(fr[SALES_COL.INV_LINK]   || '').trim(),
      invDate:    fr[SALES_COL.INV_DATE],
      dueDate:    fr[SALES_COL.DUE_DATE],
      payConf:    fr[SALES_COL.PAY_CONF],
      shipMethod: String(fr[SALES_COL.SHIP_METHOD] || '').trim(),
      shipDate:   fr[SALES_COL.SHIP_DATE],
      tracking:   String(fr[SALES_COL.TRACKING]   || '').trim(),
      shipMemo:   String(fr[SALES_COL.SHIP_MEMO]  || '').trim(),
      lineItems: lineItems,
      col14s:   col14s,
      srs:      items.map(function(i) { return i.sr; })
    };
    orders.push(ord);
    if (lineItems.length > 1) multiOrders.push(ord);
  });

  // ============================================================
  // フォーマッタ
  // ============================================================
  var fmtOrd = function(o) {
    var ls = [];
    ls.push('  OD: ' + o.odId + ' | key: ' + o.key);
    ls.push('  src rows: ' + o.srs.join(', '));
    ls.push('  -- ヘッダー26列 --');
    ls.push('  col1:オーダーID    = ' + o.odId);
    ls.push('  col2:請求書番号    = ' + o.invNo);
    ls.push('  col3:顧客ID        = ' + (o.ctId  || '【未割当】') + '  (' + o.name + ')');
    ls.push('  col4:配送先ID      = ' + (o.adId  || '【未割当】'));
    ls.push('  col5:支払先ID      = ' + (o.pyId  || '【未割当】'));
    ls.push('  col6:源流リードID  = ' + o.srcLead);
    ls.push('  col7:ステータス    = ' + o.status);
    ls.push('  col8:受注日        = (空欄)');
    ls.push('  col9:通貨          = ' + o.currency);
    ls.push('  col10:為替レート   = ' + o.rate);
    ls.push('  col11:明細合計     = ' + o.lineTotal);
    ls.push('  col12:送料         = ' + o.ship);
    ls.push('  col13:関税         = ' + o.cust);
    ls.push('  col14:請求総額     = ' + o.grand);
    ls.push('  col15:決済手段     = ' + o.payment);
    ls.push('  col16:請求書リンク = ' + o.invLink);
    ls.push('  col17:請求書発行日 = ' + fmtD(o.invDate));
    ls.push('  col18:支払期日     = ' + fmtD(o.dueDate));
    ls.push('  col19:支払確認日   = ' + fmtD(o.payConf));
    ls.push('  col20:発送方法     = ' + o.shipMethod);
    ls.push('  col21:発送日       = ' + fmtD(o.shipDate));
    ls.push('  col22:運送状番号   = ' + o.tracking);
    ls.push('  col23:発送時メモ   = ' + o.shipMemo);
    ls.push('  col24:備考         = (空欄)');
    ls.push('  col25:登録日       = (now)');
    ls.push('  col26:更新日       = (now)');
    ls.push('  -- 明細' + o.lineItems.length + '行 --');
    o.lineItems.forEach(function(li) {
      ls.push('    [行' + li.rowNum + '] ' + li.odlId
        + ' row=' + li.sr
        + ' cat=' + li.category
        + ' 商品=' + li.name
        + ' 状態=' + li.cond
        + ' SKU='  + li.sku
        + ' 数量=' + li.qty
        + ' 単価=' + li.prc
        + ' 小計=' + li.sub);
    });
    return ls.join('\n');
  };

  // ============================================================
  // レポート出力
  // ============================================================
  var totalEx = exA.length + exB.length + exC.length + exD.length;
  var totalLines = orders.reduce(function(s, o) { return s + o.lineItems.length; }, 0);

  // 1. 集計
  out.push('');
  out.push('=== 1. 集計 ===');
  out.push('元データ行数         : ' + rawData.length + '  (row' + DATA_START + '〜' + lastRow + ')');
  out.push('除外A 実質空行       : ' + exA.length + '行');
  out.push('除外B 仕入れ         : ' + exB.length + '行  rows=' + exB.join(','));
  out.push('除外C AKS            : ' + exC.length + '行  rows=' + exC.join(','));
  out.push('除外D 支払い太郎     : ' + exD.length + '行  rows=' + exD.join(','));
  out.push('除外合計             : ' + totalEx + '行');
  out.push('処理対象行数         : ' + included.length + '行');
  out.push('生成オーダー数       : ' + orders.length);
  out.push('生成明細数           : ' + totalLines);
  out.push('うち複数明細オーダー : ' + multiOrders.length + '件');

  // 2. 先頭10オーダー
  out.push('');
  out.push('=== 2. 先頭10オーダー ===');
  orders.slice(0, 10).forEach(function(o, i) {
    out.push('');
    out.push('--- [' + (i + 1) + '/' + orders.length + '] ---');
    out.push(fmtOrd(o));
  });

  // 3. 複数明細オーダー全件
  out.push('');
  out.push('=== 3. 複数明細オーダー全件 (' + multiOrders.length + '件) ===');
  multiOrders.forEach(function(o, i) {
    out.push('');
    out.push('--- multi [' + (i + 1) + '/' + multiOrders.length + '] ---');
    out.push(fmtOrd(o));
  });

  // 4. 異常一覧
  out.push('');
  out.push('=== 4. 異常一覧 (' + anomalies.length + '件) ===');
  if (anomalies.length === 0) {
    out.push('  (異常なし)');
  } else {
    anomalies.forEach(function(a, i) {
      var msg;
      switch (a.type) {
        case 'NO_CT':
          msg = '[顧客ID未特定] 取引先名="' + a.name + '" | key=' + a.key
              + ' | rows=' + a.rows.join(',');
          break;
        case 'AD_ERR':
          msg = '[配送先異常] CT=' + a.ctId + ' "' + a.name + '" | '
              + a.msg + ' | key=' + a.key;
          break;
        case 'PY_ERR':
          msg = '[支払先異常] CT=' + a.ctId + ' "' + a.name + '" | '
              + a.msg + ' | key=' + a.key;
          break;
        case 'CURRENCY':
          msg = '[通貨不正規化] 値="' + a.val + '" 取引先="' + a.name
              + '" key=' + a.key;
          break;
        case 'INCONSISTENT':
          msg = '[値不一致] ' + a.field + ' | 取引先="' + a.name
              + '" | key=' + a.key + ' | ' + a.detail;
          break;
        case 'SUB_MISMATCH':
          msg = '[小計不一致] row' + a.sr + ' 取引先="' + a.name
              + '" 数量=' + a.qty + ' 単価=' + a.prc
              + ' 再計算=' + a.calc + ' 元col16=' + a.orig
              + ' | key=' + a.key;
          break;
        default:
          msg = JSON.stringify(a);
      }
      out.push('  [' + (i + 1) + '] ' + msg);
    });
  }

  // 5. 監査: col14 vs 算出請求総額
  out.push('');
  out.push('=== 5. 監査: col14(合計)が入っている行 vs 算出請求総額 ===');
  var auditRows = [];
  rawData.forEach(function(row, idx) {
    var v = row[SALES_COL.COL14];
    if (v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) && Number(v) !== 0) {
      auditRows.push({ sr: DATA_START + idx, c14: Number(v), row: row });
    }
  });
  out.push('col14非空行数: ' + auditRows.length + '件');
  out.push('');
  out.push('sheet_row | 取引先名 | col14元合計 | 算出請求総額 | 結果');
  auditRows.forEach(function(ar) {
    var name = String(ar.row[SALES_COL.NAME] || '').trim();
    var matched = null;
    orders.forEach(function(o) { if (o.srs.indexOf(ar.sr) >= 0) matched = o; });
    var calcStr = matched ? matched.grand : '(除外行)';
    var result;
    if (!matched) {
      result = '対象外(除外)';
    } else {
      var diff = ar.c14 - matched.grand;
      result = (Math.abs(diff) < 0.01) ? '一致' : '差額=' + diff;
    }
    out.push('row' + ar.sr + ' | ' + name + ' | ' + ar.c14 + ' | ' + calcStr + ' | ' + result);
  });

  out.push('');
  out.push('=== DRY_RUN 完了 ===');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// auditInvoiceFormat — 請求書番号フォーマット分布 + 仕入れ混在検出
// 読み取り専用
// ============================================================
function auditInvoiceFormat() {
  var ss = getSpreadsheet();
  var salesSh = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  if (!salesSh) { Logger.log('ERROR: 売上データシートが見つかりません'); return; }
  var allData = salesSh.getDataRange().getValues();

  var DATA_START = 61;
  var out = ['=== §1: 請求書番号フォーマット分布 ==='];

  var cat = {
    suffix:  { count: 0, ex: [] },  // #XXXX-NN
    plain:   { count: 0, ex: [] },  // #XXXXのみ
    pSeries: { count: 0, ex: [] },  // PXXXX系
    other:   { count: 0, ex: [] }   // その他
  };
  var rawInvSet  = {};  // raw invNo → true
  var baseInvSet = {};  // base invNo → true
  var baseToRaws = {};  // base → { rawInvNo: true }
  var baseShiire = {};  // base → { included:[sr], shiire:[sr], name:'' }

  for (var i = 0; i < allData.length; i++) {
    var sr    = i + 1;
    if (sr < DATA_START) continue;
    var row   = allData[i];
    var invNo = String(row[SALES_COL.INV_NO] || '').trim();
    var stat  = String(row[SALES_COL.STATUS] || '').trim();
    var name  = String(row[SALES_COL.NAME]   || '').trim();
    var qty   = row[SALES_COL.QTY];
    var price = row[SALES_COL.UNIT_PRICE];

    // 実質空行(exA)はスキップ
    if (!name && (qty === '' || qty === null || qty === undefined)
              && (price === '' || price === null || price === undefined)) continue;

    if (invNo === '') continue;  // 請求書番号なし行はフォーマット分析対象外

    rawInvSet[invNo] = true;

    // フォーマット分類 & 基番号算出
    var base;
    if (/^#\d+-\d+$/.test(invNo)) {
      cat.suffix.count++;
      if (cat.suffix.ex.length < 5) cat.suffix.ex.push(invNo + '(row' + sr + ')');
      base = invNo.replace(/-\d+$/, '');
    } else if (/^#\d+$/.test(invNo)) {
      cat.plain.count++;
      if (cat.plain.ex.length < 5) cat.plain.ex.push(invNo + '(row' + sr + ')');
      base = invNo;
    } else if (/^[Pp]\d/.test(invNo)) {
      cat.pSeries.count++;
      if (cat.pSeries.ex.length < 5) cat.pSeries.ex.push(invNo + '(row' + sr + ')');
      base = invNo;
    } else {
      cat.other.count++;
      if (cat.other.ex.length < 10) cat.other.ex.push(invNo + '(row' + sr + ')');
      base = invNo;
    }

    baseInvSet[base] = true;
    if (!baseToRaws[base]) baseToRaws[base] = {};
    baseToRaws[base][invNo] = true;

    // 仕入れ混在チェック（exBのみ。exA/C/Dは除外済み）
    if (!baseShiire[base]) baseShiire[base] = { included: [], shiire: [], name: '' };
    if (!baseShiire[base].name && name) baseShiire[base].name = name;
    if (stat === '仕入れ') {
      baseShiire[base].shiire.push(sr);
    } else {
      baseShiire[base].included.push(sr);
    }
  }

  var totalWithInv = cat.suffix.count + cat.plain.count + cat.pSeries.count + cat.other.count;
  var rawUnique    = Object.keys(rawInvSet).length;
  var baseUnique   = Object.keys(baseInvSet).length;

  out.push('');
  out.push('フォーマット別集計:');
  out.push('  #XXXX-NN形式 : ' + cat.suffix.count  + '行  例: ' + cat.suffix.ex.join(' / '));
  out.push('  #XXXXのみ   : ' + cat.plain.count   + '行  例: ' + cat.plain.ex.join(' / '));
  out.push('  PXXXX系     : ' + cat.pSeries.count + '行  例: ' + cat.pSeries.ex.join(' / '));
  out.push('  その他      : ' + cat.other.count   + '行  例: ' + cat.other.ex.join(' / '));
  out.push('');
  out.push('請求書番号あり行合計   : ' + totalWithInv + '行');
  out.push('ユニーク請求書番号(生) : ' + rawUnique + '件');
  out.push('ユニーク基番号(-NN除去): ' + baseUnique + '件');

  // 複数rawが同一基番号を持つ系列一覧
  var mergeList = [];
  Object.keys(baseToRaws).forEach(function(b) {
    var raws = Object.keys(baseToRaws[b]);
    if (raws.length > 1) mergeList.push({ base: b, raws: raws.sort() });
  });
  mergeList.sort(function(a, b) { return b.raws.length - a.raws.length; });
  out.push('');
  out.push('--- 複数rawが同一基番号に束まる系列: ' + mergeList.length + '件 ---');
  mergeList.forEach(function(m) {
    out.push('  ' + m.base + ' (' + m.raws.length + '種) → ' + m.raws.join(', '));
  });

  // §2: 仕入れ混在系列
  out.push('');
  out.push('=== §2: 仕入れ行が混在する基番号系列 ===');
  var mixedList = [];
  Object.keys(baseShiire).forEach(function(base) {
    var b = baseShiire[base];
    if (b.shiire.length > 0 && b.included.length > 0) {
      mixedList.push({ base: base, included: b.included, shiire: b.shiire, name: b.name });
    }
  });

  if (mixedList.length === 0) {
    out.push('  (混在なし)');
  } else {
    out.push('混在系列数: ' + mixedList.length + '件');
    mixedList.forEach(function(m) {
      out.push('');
      out.push('  基番号: ' + m.base + ' / 取引先: ' + m.name);

      // 仕入れ行の金額も表示
      var shiireDetail = m.shiire.map(function(sr) {
        var r = allData[sr - 1];
        var cont = String(r[SALES_COL.INV_CONT]   || '').trim();
        var qty  = r[SALES_COL.QTY]               || '';
        var prc  = r[SALES_COL.UNIT_PRICE]        || '';
        return 'row' + sr + '(仕入れ|' + cont + '|qty=' + qty + '@' + prc + ')';
      });
      out.push('  仕入れ: ' + shiireDetail.join(' / '));
      out.push('  売上: rows=' + m.included.join(','));
    });
  }

  out.push('');
  out.push('=== audit完了 ===');
  var result = out.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// auditSalesDataTail — 読み取り専用・監査調査関数
// 用途: DRY_RUN結果の検証（差額8行 / 仕入れ11行）
// ============================================================
/**
 * 売上データ行640-711の詳細ダンプ + 差額8行分析 + 仕入れ11行一覧
 */
function auditSalesDataTail() {
  var ss = getSpreadsheet();
  var salesSh = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  if (!salesSh) { Logger.log('ERROR: 売上データシートが見つかりません'); return; }

  // 全データ取得（1行目=ヘッダー、2行目以降=データ、シート行=配列インデックス+1）
  var allData = salesSh.getDataRange().getValues();
  // allData[0] = row1(ヘッダー), allData[N-1] = rowN

  var out = [];

  // --------------------------------------------------
  // §1: row640〜711 全行詳細ダンプ
  // --------------------------------------------------
  out.push('=== §1: 売上データ row640〜711 詳細ダンプ ===');
  out.push('行番号 | ステータス | 取引先名 | 請求書番号 | 請求書内容 | 数量 | 単価 | 小計 | 合計(col14) | 送料 | 発送日 | 運送状番号');
  out.push('------+----------+---------+-----------+-----------+-----+-----+-----+------------+-----+------+----------');

  for (var sr = 640; sr <= 711; sr++) {
    var idx = sr - 1; // 0-based配列インデックス
    if (idx >= allData.length) {
      out.push('row' + sr + ' | (データなし)');
      continue;
    }
    var r = allData[idx];
    var status   = r[SALES_COL.STATUS]    || '';
    var name     = r[SALES_COL.NAME]      || '';
    var invNo    = r[SALES_COL.INV_NO]    || '';
    var invCont  = r[SALES_COL.INV_CONT]  || '';
    var qty      = r[SALES_COL.QTY]       || '';
    var price    = r[SALES_COL.UNIT_PRICE]|| '';
    var subtotal = r[SALES_COL.SUBTOTAL]  || '';
    var col14    = r[SALES_COL.COL14]     || '';
    var shipping = r[SALES_COL.SHIPPING]  || '';
    var shipDate = r[SALES_COL.SHIP_DATE] || '';
    var tracking = r[SALES_COL.TRACKING]  || '';

    out.push(
      'row' + sr + ' | ' + status + ' | ' + name + ' | ' + invNo + ' | ' +
      invCont + ' | ' + qty + ' | ' + price + ' | ' + subtotal + ' | ' +
      col14 + ' | ' + shipping + ' | ' + shipDate + ' | ' + tracking
    );
  }

  // --------------------------------------------------
  // §2: 差額8行の詳細分析
  // --------------------------------------------------
  out.push('');
  out.push('=== §2: 差額8行 詳細分析 ===');
  var DIFF_ROWS = [651, 668, 673, 679, 681, 689, 694, 700];

  DIFF_ROWS.forEach(function(sr) {
    var idx = sr - 1;
    if (idx >= allData.length) { out.push('row' + sr + ': データなし'); return; }
    var r = allData[idx];
    var name    = r[SALES_COL.NAME]     || '';
    var invNo   = r[SALES_COL.INV_NO]   || '';
    var tracking= r[SALES_COL.TRACKING] || '';
    var invCont = r[SALES_COL.INV_CONT] || '';
    var col14   = r[SALES_COL.COL14]    || 0;

    out.push('');
    out.push('--- row' + sr + ' / ' + name + ' ---');
    out.push('  請求書番号: ' + invNo);
    out.push('  運送状番号: ' + tracking);
    out.push('  col14(合計): ' + col14);
    out.push('  請求書内容(全文): ' + invCont);

    // 前後5行（±5）を走査して同じ請求書番号 or 運送状番号を持つ行を列挙
    out.push('  --- 前後5行スキャン（同INV_NO or 同TRACKING）---');
    var rangeStart = Math.max(2, sr - 5);
    var rangeEnd   = Math.min(allData.length, sr + 5);
    var matchedRows = [];
    var sumQtyPrice = 0;
    for (var s2 = rangeStart; s2 <= rangeEnd; s2++) {
      if (s2 === sr) continue;
      var r2 = allData[s2 - 1];
      var r2inv  = r2[SALES_COL.INV_NO]    || '';
      var r2trk  = r2[SALES_COL.TRACKING]  || '';
      var r2name = r2[SALES_COL.NAME]       || '';
      var r2cont = r2[SALES_COL.INV_CONT]   || '';
      var r2qty  = Number(r2[SALES_COL.QTY])        || 0;
      var r2prc  = Number(r2[SALES_COL.UNIT_PRICE]) || 0;
      var r2sub  = Number(r2[SALES_COL.SUBTOTAL])   || 0;
      var r2c14  = r2[SALES_COL.COL14]     || '';

      var sameInv = (invNo   && r2inv  === invNo);
      var sameTrk = (tracking && tracking !== '' && r2trk === tracking);
      if (sameInv || sameTrk) {
        var tag = sameInv ? '[同INV]' : '[同TRK]';
        sumQtyPrice += (r2qty * r2prc) || r2sub;
        matchedRows.push('    row' + s2 + ' ' + tag + ' | ' + r2name + ' | cont=' + r2cont +
          ' | qty=' + r2qty + ' @' + r2prc + ' sub=' + r2sub + ' c14=' + r2c14);
      }
    }
    if (matchedRows.length === 0) {
      out.push('    (一致行なし)');
    } else {
      matchedRows.forEach(function(line){ out.push(line); });
      var myQty   = Number(r[SALES_COL.QTY])        || 0;
      var myPrice = Number(r[SALES_COL.UNIT_PRICE])  || 0;
      var mySub   = Number(r[SALES_COL.SUBTOTAL])    || 0;
      var myContrib = (myQty * myPrice) || mySub;
      var totalCalc = myContrib + sumQtyPrice;
      var diff = Number(col14) - totalCalc;
      out.push('    合計確認: 本行=' + myContrib + ' 隣接合計=' + sumQtyPrice +
        ' 全合計=' + totalCalc + ' col14=' + col14 + ' 差額=' + diff);
    }
  });

  // --------------------------------------------------
  // §3: 仕入れ11行 一覧
  // --------------------------------------------------
  out.push('');
  out.push('=== §3: 除外B(仕入れ) 11行 詳細 ===');
  var SHIIRE_ROWS = [194, 199, 219, 226, 238, 241, 301, 324, 360, 449, 672];
  out.push('行番号 | 取引先名 | 請求書内容 | 数量 | 単価 | 小計 | 合計(col14) | 通貨 | ステータス');
  SHIIRE_ROWS.forEach(function(sr) {
    var idx = sr - 1;
    if (idx >= allData.length) { out.push('row' + sr + ': データなし'); return; }
    var r = allData[idx];
    var name    = r[SALES_COL.NAME]       || '';
    var invCont = r[SALES_COL.INV_CONT]   || '';
    var qty     = r[SALES_COL.QTY]        || '';
    var price   = r[SALES_COL.UNIT_PRICE] || '';
    var subtotal= r[SALES_COL.SUBTOTAL]   || '';
    var col14   = r[SALES_COL.COL14]      || '';
    var currency= r[SALES_COL.CURRENCY]   || '';
    var status  = r[SALES_COL.STATUS]     || '';
    out.push('row' + sr + ' | ' + name + ' | ' + invCont + ' | ' + qty + ' | ' + price +
      ' | ' + subtotal + ' | ' + col14 + ' | ' + currency + ' | ' + status);
  });

  out.push('');
  out.push('=== audit完了 ===');

  var result = out.join('\n');
  Logger.log(result);
  return result;
}
