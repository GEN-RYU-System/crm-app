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

// オーダー内フィールド一致チェック対象（先頭行採用・不一致を異常出力）
// ※ 通貨/発送日/運送状番号/発送方法/請求書リンクは個別ロジックで処理
var SALES_CONSISTENCY_COLS = [
  { c: SALES_COL.INV_DATE,    label: '請求書発行日' },
  { c: SALES_COL.DUE_DATE,    label: '支払期日' },
  { c: SALES_COL.PAY_CONF,    label: '支払確認日' }
];

/**
 * メインエントリ
 */
function migrateSalesData(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'CONFIRM') {
    return 'ERROR: mode は "DRY_RUN" または "CONFIRM" を指定してください';
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
  // 事前パス: 仕入れ行の混在系列判定
  // 「請求書番号があり、同じ基番号の系列に他の非仕入れ行が存在する」 → 売上として含める
  // ============================================================
  var baseInvMixed = {};  // baseNo → true（仕入れ＋非仕入れ が混在する系列）
  (function() {
    var bHas = {};
    rawData.forEach(function(row) {
      var invNo = String(row[SALES_COL.INV_NO] || '').trim();
      if (!invNo) return;
      var base = baseInvNo(invNo);
      if (!bHas[base]) bHas[base] = { s: false, n: false };
      if (String(row[SALES_COL.STATUS] || '').trim() === '仕入れ') {
        bHas[base].s = true;
      } else {
        bHas[base].n = true;
      }
    });
    Object.keys(bHas).forEach(function(b) {
      if (bHas[b].s && bHas[b].n) baseInvMixed[b] = true;
    });
  })();

  // ============================================================
  // フィルタリング
  // ============================================================
  var exA = [], exBPure = [], exBIncluded = [], exC = [], exD = [];
  var included = [];

  rawData.forEach(function(row, idx) {
    var sr     = DATA_START + idx;
    var status = String(row[SALES_COL.STATUS] || '').trim();
    var name   = String(row[SALES_COL.NAME]   || '').trim();
    var qty    = row[SALES_COL.QTY];
    var price  = row[SALES_COL.UNIT_PRICE];
    var invNo  = String(row[SALES_COL.INV_NO] || '').trim();

    if (status === '仕入れ') {
      // 系列に他の売上行がある → 売上明細として含める
      if (invNo && baseInvMixed[baseInvNo(invNo)]) {
        exBIncluded.push(sr);
        included.push({ row: row, sr: sr });
        return;
      }
      exBPure.push(sr); return;
    }
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
  var concatLog = [];   // 運送状番号/発送方法の連結イベント記録

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

    // ── 通貨: 非空優先。複数種類があれば異常 ──────────────────────
    var currVals = [];
    items.forEach(function(it) {
      var res = normCurr(it.row[SALES_COL.CURRENCY]);
      if (res.val === '') return;
      if (!res.ok) {
        anomalies.push({ type: 'CURRENCY', key: key, name: custName, val: res.val });
      } else if (currVals.indexOf(res.val) < 0) {
        currVals.push(res.val);
      }
    });
    if (currVals.length > 1) {
      anomalies.push({ type: 'MULTI_CURRENCY', key: key, name: custName, vals: currVals.join(',') });
    }
    var currFinal = currVals.length > 0 ? currVals[0] : '';

    // ── 運送状番号: 非空値を重複除去して " / " 連結 ──────────────
    var trackVals = [];
    items.forEach(function(it) {
      var v = String(it.row[SALES_COL.TRACKING] || '').trim();
      if (v && trackVals.indexOf(v) < 0) trackVals.push(v);
    });
    var trackStr = trackVals.join(' / ');
    if (trackVals.length > 1) {
      concatLog.push({ key: key, name: custName, field: '運送状番号', vals: trackVals });
    }

    // ── 発送方法: 非空値を重複除去して " / " 連結 ────────────────
    var shipMethVals = [];
    items.forEach(function(it) {
      var v = String(it.row[SALES_COL.SHIP_METHOD] || '').trim();
      if (v && shipMethVals.indexOf(v) < 0) shipMethVals.push(v);
    });
    var shipMethStr = shipMethVals.join(' / ');
    if (shipMethVals.length > 1) {
      concatLog.push({ key: key, name: custName, field: '発送方法', vals: shipMethVals });
    }

    // ── 発送日: 系列内の最も早い日付を採用 ───────────────────────
    var shipDateVal = null;
    items.forEach(function(it) {
      var v = it.row[SALES_COL.SHIP_DATE];
      if (v instanceof Date && !isNaN(v.getTime())) {
        if (!shipDateVal || v < shipDateVal) shipDateVal = v;
      }
    });

    // ── 請求書リンク: 最初の非空値を採用。他と異なれば異常 ───────
    var invLinkVals = [];
    items.forEach(function(it) {
      var v = String(it.row[SALES_COL.INV_LINK] || '').trim();
      if (v && invLinkVals.indexOf(v) < 0) invLinkVals.push(v);
    });
    var invLinkFinal = invLinkVals.length > 0 ? invLinkVals[0] : '';
    if (invLinkVals.length > 1) {
      anomalies.push({ type: 'INV_LINK_MISMATCH', key: key, name: custName,
        detail: invLinkVals.join(' / ') });
    }

    // ── 請求書発行日/支払期日/支払確認日: 先頭行、食い違いは異常 ─
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

    // ステータス: 仕入れ行が系列先頭に来る場合は非仕入れ行の値を採用
    var statusItem = null;
    items.forEach(function(it) {
      if (!statusItem && String(it.row[SALES_COL.STATUS] || '').trim() !== '仕入れ') {
        statusItem = it;
      }
    });
    var orderStatus = statusItem
      ? String(statusItem.row[SALES_COL.STATUS] || '').trim()
      : String(fr[SALES_COL.STATUS] || '').trim();

    var ord = {
      key: key,  odId: 'OD-' + ('00000' + odSeq++).slice(-5),
      invNo:    baseInvNo(String(fr[SALES_COL.INV_NO] || '').trim()),
      name:     custName,
      ctId:     ctId || '',
      adId:     adR.id,
      pyId:     pyR.id,
      srcLead:  ctId ? (ctToSrc[ctId] || '') : '',
      status:   orderStatus,
      currency: currFinal,
      rate:     fr[SALES_COL.RATE],
      lineTotal: lineTotal, ship: totalShip, cust: totalCust, grand: grand,
      payment:    String(fr[SALES_COL.PAYMENT]    || '').trim(),
      invLink:    invLinkFinal,
      invDate:    fr[SALES_COL.INV_DATE],
      dueDate:    fr[SALES_COL.DUE_DATE],
      payConf:    fr[SALES_COL.PAY_CONF],
      shipMethod: shipMethStr,
      shipDate:   shipDateVal,
      tracking:   trackStr,
      shipMemo:   String(fr[SALES_COL.SHIP_MEMO]  || '').trim(),
      lineItems: lineItems,
      col14s:   col14s,
      srs:      items.map(function(i) { return i.sr; })
    };
    orders.push(ord);
    if (lineItems.length > 1) multiOrders.push(ord);
  });

  // ============================================================
  // CONFIRM モード: 書込 → 検証8点 → 移行完了判定
  // ============================================================
  if (mode === 'CONFIRM') {
    var cOut  = ['=== migrateSalesData(CONFIRM) ==='];
    var now   = new Date();
    var nowStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    var ve    = [];  // 検証エラー収集

    // ── シート取得 ─────────────────────────────────────────────
    var omSh = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
    var olSh = ss.getSheetByName(CONFIG.SHEETS.ORDER_LINES);
    if (!omSh || !olSh) {
      Logger.log('ERROR: シートが見つかりません。createOrderTabs() を先に実行してください');
      return 'ERROR: シートが見つかりません';
    }

    // ── 既存データ クリア (ヘッダー行を除くデータ行) ───────────
    var omLast = omSh.getLastRow();
    if (omLast > 1) omSh.getRange(2, 1, omLast - 1, 26).clearContent();
    var olLast = olSh.getLastRow();
    if (olLast > 1) olSh.getRange(2, 1, olLast - 1, 10).clearContent();

    // ── 行配列 構築 ─────────────────────────────────────────────
    var omRows = orders.map(function(o) {
      return [
        o.odId,                                           // 1: オーダーID
        o.invNo,                                          // 2: 請求書番号
        o.ctId,                                           // 3: 顧客ID
        o.adId,                                           // 4: 配送先ID
        o.pyId,                                           // 5: 支払先ID
        o.srcLead,                                        // 6: 源流リードID
        o.status,                                         // 7: ステータス
        '',                                               // 8: 受注日（空欄）
        o.currency,                                       // 9: 通貨
        (o.rate !== '' && o.rate !== null && o.rate !== undefined) ? o.rate : '',  // 10: 為替レート
        o.lineTotal,                                      // 11: 明細合計
        o.ship,                                           // 12: 送料
        o.cust,                                           // 13: 関税
        o.grand,                                          // 14: 請求総額
        o.payment,                                        // 15: 決済手段
        o.invLink,                                        // 16: 請求書リンク
        fmtD(o.invDate),                                  // 17: 請求書発行日
        fmtD(o.dueDate),                                  // 18: 支払期日
        fmtD(o.payConf),                                  // 19: 支払確認日
        o.shipMethod,                                     // 20: 発送方法
        fmtD(o.shipDate),                                 // 21: 発送日
        String(o.tracking),                               // 22: 運送状番号（必ず string）
        o.shipMemo,                                       // 23: 発送時メモ
        '',                                               // 24: 備考
        nowStr,                                           // 25: 登録日
        nowStr                                            // 26: 更新日
      ];
    });

    var olRows = [];
    orders.forEach(function(o) {
      o.lineItems.forEach(function(li) {
        olRows.push([
          li.odlId, o.odId, li.rowNum, li.category,
          li.name, li.cond, li.sku, li.qty, li.prc, li.sub
        ]);
      });
    });

    // ── バッチ書込 ───────────────────────────────────────────────
    // 運送状番号列(col22)をテキスト形式に設定してから書込
    omSh.getRange(2, 22, omRows.length, 1).setNumberFormat('@');
    omSh.getRange(2, 1, omRows.length, 26).setValues(omRows);
    olSh.getRange(2, 1, olRows.length, 10).setValues(olRows);

    cOut.push('');
    cOut.push('書込完了: オーダー管理=' + omRows.length + '行 / オーダー明細=' + olRows.length + '行');

    // ── 検証 8点 ────────────────────────────────────────────────
    cOut.push('');
    cOut.push('=== 検証 ===');

    // [1] 行数
    var omAct = omSh.getLastRow() - 1;
    var olAct = olSh.getLastRow() - 1;
    var p1 = (omAct === omRows.length && olAct === olRows.length);
    cOut.push('[1] 行数: オーダー管理=' + omAct + ' / オーダー明細=' + olAct + ' → ' + (p1 ? '合格' : '★不合格'));
    if (!p1) ve.push('[1]行数');

    // [2] 請求総額 = 明細合計 + 送料 + 関税
    var p2f = [];
    orders.forEach(function(o) {
      var calc = o.lineTotal + o.ship + o.cust;
      if (Math.abs(o.grand - calc) > 0.01) p2f.push(o.odId + '(grand=' + o.grand + ' calc=' + calc + ')');
    });
    cOut.push('[2] 請求総額=明細合計+送料+関税: ' + orders.length + '件中 不一致=' + p2f.length + ' → ' + (p2f.length === 0 ? '合格' : '★不合格 ' + p2f.slice(0,5).join(' ')));
    if (p2f.length > 0) ve.push('[2]');

    // [3] 小計 = 数量 × 単価
    var p3f = [];
    orders.forEach(function(o) {
      o.lineItems.forEach(function(li) {
        var calc = li.qty * li.prc;
        if (Math.abs(li.sub - calc) > 0.01) p3f.push(li.odlId + '(sub=' + li.sub + ' calc=' + calc + ')');
      });
    });
    cOut.push('[3] 小計=数量×単価: ' + olRows.length + '明細中 不一致=' + p3f.length + ' → ' + (p3f.length === 0 ? '合格' : '★不合格 ' + p3f.slice(0,5).join(' ')));
    if (p3f.length > 0) ve.push('[3]');

    // [4] CT/AD/PY 実在・紐付け
    var ctSet = {};
    for (var ci4 = 1; ci4 < custAll.length; ci4++) {
      var cd4 = String(custAll[ci4][cHId] || '').trim();
      if (cd4) ctSet[cd4] = true;
    }
    var adByCt4 = {};
    for (var si4 = 1; si4 < shipAll.length; si4++) {
      var sc4 = String(shipAll[si4][sHCt] || '').trim();
      var sa4 = String(shipAll[si4][sHAd] || '').trim();
      if (!sc4 || !sa4) continue;
      if (!adByCt4[sc4]) adByCt4[sc4] = {};
      adByCt4[sc4][sa4] = true;
    }
    var pyByCt4 = {};
    for (var pi4 = 1; pi4 < payAll.length; pi4++) {
      var pc4 = String(payAll[pi4][pHCt] || '').trim();
      var pp4 = String(payAll[pi4][pHPy] || '').trim();
      if (!pc4 || !pp4) continue;
      if (!pyByCt4[pc4]) pyByCt4[pc4] = {};
      pyByCt4[pc4][pp4] = true;
    }
    var p4f = [];
    orders.forEach(function(o) {
      if (o.ctId && !ctSet[o.ctId]) p4f.push('CT不存在:' + o.ctId + '(' + o.odId + ')');
      if (o.ctId && o.adId && !(adByCt4[o.ctId] && adByCt4[o.ctId][o.adId]))
        p4f.push('AD紐付け不整合:' + o.adId + '∉' + o.ctId + '(' + o.odId + ')');
      if (o.ctId && o.pyId && !(pyByCt4[o.ctId] && pyByCt4[o.ctId][o.pyId]))
        p4f.push('PY紐付け不整合:' + o.pyId + '∉' + o.ctId + '(' + o.odId + ')');
    });
    cOut.push('[4] CT/AD/PY 親子整合: 不整合=' + p4f.length + '件 → ' + (p4f.length === 0 ? '合格' : '★不合格 ' + p4f.slice(0,5).join(' ')));
    if (p4f.length > 0) ve.push('[4]');

    // [5] 孤児明細（書込後実データで検証）
    var odIdSet5 = {};
    orders.forEach(function(o) { odIdSet5[o.odId] = true; });
    var olCheck = olSh.getRange(2, 2, olAct, 1).getValues();  // col2 = オーダーID
    var p5f = 0;
    olCheck.forEach(function(r) {
      var pid = String(r[0] || '').trim();
      if (pid && !odIdSet5[pid]) p5f++;
    });
    cOut.push('[5] 孤児明細: ' + p5f + '件 → ' + (p5f === 0 ? '合格' : '★不合格'));
    if (p5f > 0) ve.push('[5]');

    // [6] 採番 連番・重複なし
    var odArr = orders.map(function(o) { return o.odId; });
    var odDup = 0, odSeq = 0;
    var odSeen = {};
    odArr.forEach(function(id, i) {
      if (odSeen[id]) odDup++;
      odSeen[id] = true;
      if (id !== 'OD-' + ('00000' + (i + 1)).slice(-5)) odSeq++;
    });
    var odlArr = [];
    orders.forEach(function(o) { o.lineItems.forEach(function(li) { odlArr.push(li.odlId); }); });
    var odlDup = 0, odlSeq = 0;
    var odlSeen = {};
    odlArr.forEach(function(id, i) {
      if (odlSeen[id]) odlDup++;
      odlSeen[id] = true;
      if (id !== 'ODL-' + ('00000' + (i + 1)).slice(-5)) odlSeq++;
    });
    var p6ok = (odDup + odSeq + odlDup + odlSeq === 0);
    cOut.push('[6] 採番: OD重複=' + odDup + ' OD連番エラー=' + odSeq + ' / ODL重複=' + odlDup + ' ODL連番エラー=' + odlSeq + ' → ' + (p6ok ? '合格' : '★不合格'));
    if (!p6ok) ve.push('[6]');

    // [7] 運送状番号 string型（書込後実データ）
    var trkData = omSh.getRange(2, 22, omAct, 1).getValues();
    var p7f = 0;
    trkData.forEach(function(r) { if (typeof r[0] !== 'string') p7f++; });
    cOut.push('[7] 運送状番号 string型: ' + omAct + '件中 非string=' + p7f + '件 → ' + (p7f === 0 ? '合格' : '★不合格'));
    if (p7f > 0) ve.push('[7]');

    // [8] col14 8件 書込後実データ再検証
    var omData14 = omSh.getRange(2, 1, omAct, 14).getValues();
    var odGrandMap = {};
    omData14.forEach(function(r) {
      var id = String(r[0] || '').trim();
      if (id) odGrandMap[id] = Number(r[13]);
    });
    var c14Rows = [];
    rawData.forEach(function(row, idx) {
      var v = row[SALES_COL.COL14];
      if (v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) && Number(v) !== 0) {
        c14Rows.push({ sr: DATA_START + idx, c14: Number(v) });
      }
    });
    var p8ok = 0, p8ng = 0;
    cOut.push('[8] col14 書込後再検証:');
    c14Rows.forEach(function(ar) {
      var mo = null;
      orders.forEach(function(o) { if (o.srs.indexOf(ar.sr) >= 0) mo = o; });
      if (!mo) { cOut.push('  row' + ar.sr + ': 対象外(除外行)'); return; }
      var wg = odGrandMap[mo.odId];
      var diff = ar.c14 - wg;
      var ok = Math.abs(diff) < 0.01;
      if (ok) p8ok++; else p8ng++;
      cOut.push('  row' + ar.sr + ' | col14=' + ar.c14 + ' | 書込grand=' + wg + ' | ' + (ok ? '一致' : '★差額=' + diff));
    });
    cOut.push('  ' + p8ok + '件一致 / ' + p8ng + '件不一致 → ' + (p8ng === 0 ? '合格' : '★不合格'));
    if (p8ng > 0) ve.push('[8]');

    // 異常件数
    cOut.push('');
    cOut.push('DRY_RUN時の異常件数 (参考): ' + anomalies.length + '件（CONFIRM時に書込は完了済み）');

    // ── 最終判定 ────────────────────────────────────────────────
    cOut.push('');
    cOut.push('=== 最終判定 ===');
    if (ve.length === 0) {
      cOut.push('8点すべて合格 — 移行完了');
    } else {
      cOut.push('★不合格 ' + ve.length + '件: ' + ve.join(' / '));
    }

    var cResult = cOut.join('\n');
    Logger.log(cResult);
    return cResult;
  }

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
  var totalEx = exA.length + exBPure.length + exC.length + exD.length;
  var totalLines = orders.reduce(function(s, o) { return s + o.lineItems.length; }, 0);

  // 1. 集計
  out.push('');
  out.push('=== 1. 集計 ===');
  out.push('元データ行数              : ' + rawData.length + '  (row' + DATA_START + '〜' + lastRow + ')');
  out.push('除外A 実質空行            : ' + exA.length + '行');
  out.push('除外B 仕入れ(純粋除外)   : ' + exBPure.length + '行  rows=' + exBPure.join(','));
  out.push('除外B 仕入れ(系列含・再分類): ' + exBIncluded.length + '行  rows=' + exBIncluded.join(','));
  out.push('除外C AKS                 : ' + exC.length + '行  rows=' + exC.join(','));
  out.push('除外D 支払い太郎          : ' + exD.length + '行  rows=' + exD.join(','));
  out.push('除外合計(純粋除外のみ)    : ' + totalEx + '行');
  out.push('処理対象行数              : ' + included.length + '行');
  out.push('生成オーダー数            : ' + orders.length);
  out.push('生成明細数                : ' + totalLines);

  // 1b. 仕入れ行 個別判定
  out.push('');
  out.push('=== 1b. 仕入れ11行 個別判定 ===');
  var SHIIRE_ALL = [194,199,219,226,238,241,301,324,360,449,672];
  SHIIRE_ALL.forEach(function(sr) {
    var row    = rawData[sr - DATA_START];
    if (!row) { out.push('row' + sr + ': データなし'); return; }
    var invNo  = String(row[SALES_COL.INV_NO] || '').trim();
    var base   = invNo ? baseInvNo(invNo) : '';
    var name   = String(row[SALES_COL.NAME]   || '').trim();
    var cont   = String(row[SALES_COL.INV_CONT] || '').trim();
    var isIncl = exBIncluded.indexOf(sr) >= 0;
    var reason, series;
    if (isIncl) {
      reason = '売上含める';
      series = base + '(混在系列)';
    } else if (!invNo) {
      reason = '除外: 請求書番号なし';
      series = '-';
    } else if (!baseInvMixed[base]) {
      reason = '除外: 系列に他の売上行なし';
      series = base + '(仕入れのみ)';
    } else {
      reason = '除外: (その他)';
      series = base;
    }
    out.push('row' + sr + ' | ' + name + ' | ' + cont + ' | → ' + reason + ' | 系列: ' + series);
  });
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
        case 'MULTI_CURRENCY':
          msg = '[通貨複数種類] vals="' + a.vals + '" 取引先="' + a.name
              + '" key=' + a.key;
          break;
        case 'INV_LINK_MISMATCH':
          msg = '[請求書リンク不一致] 取引先="' + a.name + '" key=' + a.key
              + ' | ' + a.detail;
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

  // 5. 連結ログ
  out.push('');
  var concatTrack = concatLog.filter(function(c) { return c.field === '運送状番号'; });
  var concatMeth  = concatLog.filter(function(c) { return c.field === '発送方法'; });
  out.push('=== 5. 連結ログ ===');
  out.push('運送状番号を連結したオーダー: ' + concatTrack.length + '件');
  out.push('発送方法を連結したオーダー  : ' + concatMeth.length + '件');
  out.push('');
  out.push('運送状番号 連結実例（先頭5件）:');
  concatTrack.slice(0, 5).forEach(function(c) {
    out.push('  ' + c.key + ' | ' + c.name + ' → ' + c.vals.join(' / '));
  });

  // 6. 監査: col14 vs 算出請求総額
  out.push('');
  out.push('=== 6. 監査: col14(合計)が入っている行 vs 算出請求総額 ===');
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

// ============================================================
// auditSalesColumns — 売上データ 158列 性質全件調査（読取専用）
// ============================================================
function auditSalesColumns() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  var lastCol = sh.getLastColumn();

  // ヘッダ行取得
  var row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0]; // グループ名
  var row3 = sh.getRange(3, 1, 1, lastCol).getValues()[0]; // 列名

  // row1は結合セルのため値のある列から引き継ぎ
  var groupNames = [];
  var cur = '';
  for (var c = 0; c < lastCol; c++) {
    var g = String(row1[c] || '').trim();
    if (g) cur = g;
    groupNames.push(cur || '(グループ名なし)');
  }

  // データ行 61〜711（651行）
  var DATA_START = 61;
  var DATA_END   = 711;
  var nRows = DATA_END - DATA_START + 1;
  var dRange = sh.getRange(DATA_START, 1, nRows, lastCol);
  var vals = dRange.getValues();
  var fmls = dRange.getFormulas();

  // 各列を分析
  var colInfos = [];
  for (var c = 0; c < lastCol; c++) {
    var hasFml = false, fmlEx = '';
    for (var r = 0; r < nRows; r++) {
      if (fmls[r][c]) { hasFml = true; fmlEx = fmls[r][c]; break; }
    }
    var fillCount = 0;
    var samples = [];
    var typeMap = {};
    for (var r = 0; r < nRows; r++) {
      var v = vals[r][c];
      if (v !== '' && v !== null && v !== undefined) {
        fillCount++;
        if (samples.length < 3) {
          var sv = v instanceof Date
            ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd')
            : String(v).substring(0, 40);
          samples.push(sv);
        }
        var tp = v instanceof Date ? 'date' : typeof v;
        typeMap[tp] = (typeMap[tp] || 0) + 1;
      }
    }
    var domType = 'empty';
    var maxCnt = 0;
    Object.keys(typeMap).forEach(function(t) {
      if (typeMap[t] > maxCnt) { maxCnt = typeMap[t]; domType = t; }
    });
    colInfos.push({
      c: c,
      colNum: c + 1,
      group: groupNames[c],
      name: String(row3[c] || '').trim() || '(列名なし)',
      hasFml: hasFml,
      fmlEx: fmlEx.substring(0, 80),
      fill: fillCount,
      type: domType,
      samples: samples
    });
  }

  // グループ別に整理
  var seenGroups = [];
  var groupMap = {};
  colInfos.forEach(function(ci) {
    if (!groupMap[ci.group]) { groupMap[ci.group] = []; seenGroups.push(ci.group); }
    groupMap[ci.group].push(ci);
  });

  var lines = [
    '=== 売上データ 列性質調査（' + lastCol + '列）===',
    'データ行: ' + DATA_START + '〜' + DATA_END + '（' + nRows + '行）',
    ''
  ];

  seenGroups.forEach(function(g) {
    var cols = groupMap[g];
    lines.push('【' + g + '】（' + cols.length + '列: col' + cols[0].colNum + '〜col' + cols[cols.length-1].colNum + '）');
    cols.forEach(function(ci) {
      var fmlStr = ci.hasFml ? ('数式[' + ci.fmlEx + ']') : '入力';
      lines.push(
        'col' + ci.colNum + ' | ' + ci.name + ' | ' + fmlStr +
        ' | ' + ci.fill + '/651 | ' + ci.type +
        ' | ' + ci.samples.join(' / ')
      );
    });
    lines.push('');
  });

  // 売上情報の数式列まとめ
  lines.push('=== 売上情報 数式列サマリ ===');
  var salesGroup = null;
  seenGroups.forEach(function(g) { if (g.indexOf('売上') >= 0) salesGroup = g; });
  if (salesGroup && groupMap[salesGroup]) {
    groupMap[salesGroup].forEach(function(ci) {
      if (ci.hasFml) lines.push('col' + ci.colNum + ' ' + ci.name + ': ' + ci.fmlEx);
    });
  } else {
    lines.push('売上情報グループが見つかりませんでした（実グループ名: ' + seenGroups.join(', ') + '）');
  }
  lines.push('');

  // 仕入れ情報のオーダー参照候補列
  lines.push('=== 仕入れ情報 オーダー参照候補 ===');
  var siiGroup = null;
  seenGroups.forEach(function(g) { if (g.indexOf('仕入') >= 0) siiGroup = g; });
  if (siiGroup && groupMap[siiGroup]) {
    groupMap[siiGroup].forEach(function(ci) {
      var nm = ci.name;
      if (nm.match(/請求|オーダー|order|inv|参照|対応|紐付|NO|番号/i) || ci.hasFml || ci.fill > 0) {
        lines.push('col' + ci.colNum + ' ' + ci.name +
          ' | hasFml=' + ci.hasFml + ' | fill=' + ci.fill + '/651' +
          ' | サンプル: ' + ci.samples.join(' / '));
      }
    });
  } else {
    lines.push('仕入れ情報グループが見つかりませんでした');
  }
  lines.push('');

  // 予約販売・トラブル充足率
  lines.push('=== 予約販売・トラブル 充足率 ===');
  seenGroups.forEach(function(g) {
    if (g.indexOf('予約') >= 0 || g.indexOf('トラブル') >= 0) {
      var cols = groupMap[g];
      var totalFill = 0;
      cols.forEach(function(ci) { totalFill += ci.fill; });
      var avgFill = cols.length > 0 ? Math.round(totalFill / cols.length) : 0;
      lines.push(g + ': ' + cols.length + '列 / 平均充足=' + avgFill + '/651行');
      cols.forEach(function(ci) {
        lines.push('  col' + ci.colNum + ' ' + ci.name + ': ' + ci.fill + '/651');
      });
    }
  });
  lines.push('');

  // 複数個口オーダー分析
  lines.push('=== 複数個口オーダー分析 ===');
  var koguchiCol = -1;
  colInfos.forEach(function(ci) {
    if (ci.name.indexOf('個口') >= 0 || ci.name.indexOf('箱数') >= 0) koguchiCol = ci.c;
  });

  if (koguchiCol < 0) {
    lines.push('個口数列(個口/箱数)が見つかりませんでした。発送グループの数値列:');
    seenGroups.forEach(function(g) {
      if (g.indexOf('発送') >= 0) {
        groupMap[g].forEach(function(ci) {
          if (ci.type === 'number' && ci.fill > 0)
            lines.push('  col' + ci.colNum + ' ' + ci.name + ' fill=' + ci.fill + ' サンプル:' + ci.samples.join('/'));
        });
      }
    });
  } else {
    var multiRows = [];
    for (var r2 = 0; r2 < nRows; r2++) {
      var kv = vals[r2][koguchiCol];
      if (typeof kv === 'number' && kv > 1) multiRows.push(r2);
    }
    lines.push('個口数列: col' + (koguchiCol + 1) + ' / 複数個口行数: ' + multiRows.length);

    // 発送グループの寸法・重量関連列
    var dimCols = [];
    colInfos.forEach(function(ci) {
      if (ci.group.indexOf('発送') >= 0 || ci.group.indexOf('elogi') >= 0 || ci.group.indexOf('ogi') >= 0) {
        if (ci.name.match(/寸法|重量|縦|横|高さ|幅|長さ|cm|kg|weight|size|箱|個口|数量/i) || ci.type === 'number')
          dimCols.push(ci);
      }
    });

    var shown = 0;
    for (var i = 0; i < multiRows.length && shown < 2; i++) {
      var r3 = multiRows[i];
      lines.push('--- 例' + (shown + 1) + ': データ行' + (DATA_START + r3) + '（個口数=' + vals[r3][koguchiCol] + '）---');
      lines.push('  名前(col6): ' + String(vals[r3][5] || ''));
      lines.push('  請求書番号(col12): ' + String(vals[r3][11] || ''));
      dimCols.forEach(function(ci) {
        var dv = vals[r3][ci.c];
        if (dv !== '' && dv !== null && dv !== undefined) {
          var ds = dv instanceof Date ? Utilities.formatDate(dv, 'Asia/Tokyo', 'yyyy/MM/dd') : String(dv);
          lines.push('  col' + ci.colNum + ' ' + ci.name + ': ' + ds);
        }
      });
      shown++;
    }
  }

  lines.push('');
  lines.push('=== 調査完了 ===');
  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// auditProfitFormulas — 売上情報 利益計算ロジック証拠確立（読取専用）
// ============================================================
function auditProfitFormulas() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);

  var DATA_START = 61, DATA_END = 711;
  var nRows = DATA_END - DATA_START + 1; // 651

  // --- データ取得 ---
  // 数式原文: row61, col126-151 (26列)
  var fmls = sh.getRange(61, 126, 1, 26).getFormulas()[0];
  // 列名: row3, col1-158
  var allNames = sh.getRange(3, 1, 1, 158).getValues()[0];
  // 値: rows61-711, col1-147
  var data = sh.getRange(DATA_START, 1, nRows, 147).getValues();

  function colName(n) { return String(allNames[n - 1] || '').trim() || '(列名なし)'; }
  function a1ToNum(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + s.charCodeAt(i) - 64;
    return n;
  }
  function toNum(v) {
    if (typeof v === 'number') return v;
    var p = parseFloat(String(v || ''));
    return isNaN(p) ? 0 : p;
  }

  var lines = ['=== 売上情報 利益計算ロジック調査 ===', ''];

  // ============================================================
  // Section 1: 数式原文（省略なし）
  // ============================================================
  lines.push('--- Section1: 数式原文（row61・A1形式・省略なし）---');
  for (var i = 0; i < 26; i++) {
    var cn = 126 + i;
    lines.push('col' + cn + ' ' + colName(cn) + ':');
    lines.push('  ' + (fmls[i] || '(数式なし)'));
  }
  lines.push('');

  // ============================================================
  // Section 2: 参照列マッピング
  // ============================================================
  lines.push('--- Section2: 参照列マッピング（数式内の全セル参照）---');
  var allFmlStr = fmls.join(' ');
  var refRe = /([A-Z]{1,2})61/g, m;
  var seen = {};
  while ((m = refRe.exec(allFmlStr)) !== null) seen[m[1]] = true;
  Object.keys(seen).sort(function(a, b) { return a1ToNum(a) - a1ToNum(b); }).forEach(function(letters) {
    var num = a1ToNum(letters);
    var nm = (num >= 1 && num <= 158) ? colName(num) : '(範囲外)';
    lines.push(letters + '61 = col' + num + ' ' + nm);
  });
  lines.push('');

  // ============================================================
  // Section 3: 日本語計算仕様
  // ============================================================
  lines.push('--- Section3: 日本語計算仕様 ---');
  var specs = [
    'col126 売上高:          [col2]="キャンセル"→0  /  他→ 単価[col15]×数量[col11] + 送料[col18]',
    'col127 仕入れ費用:      [col2]="キャンセル"→0  /  他→ 仕入れ総額[col94]',
    'col128 仕入れ送料:      [col2]="キャンセル"→0  /  他→ 仕入れ送料/代行費[col95]',
    'col129 PayPal手数料:    [col2]="キャンセル"→0  /  決済[col19]="PayPal"→売上高[col126]×5%  /  他→"0"(文字列)',
    'col130 WISE手数料:      [col2]="キャンセル"→0  /  決済[col19]="WISE"→219円固定  /  他→0',
    'col131 外注費用:        [col2]="キャンセル"→0  /  他→ SUM([営業]報酬[col132]+[受注][col133]+[発送][col134]+[仕入れ][col135]+[トラブル][col136])',
    'col132 [営業]報酬:      [col2]="キャンセル"→0  /  受注担当[col4]=""→0  /  受注担当≠"谷澤"→インセンティブ計算用[col146]×10%  /  他→0',
    'col133 [受注]報酬:      col132と同式',
    'col134 [発送]報酬:      [col2]="キャンセル"→0  /  発送担当[col40]=""→0  /  発送担当≠"谷澤"→200円固定  /  他→0',
    'col135 [仕入れ]報酬:    仕入れ担当[col87]=""→0  /  担当≠"谷澤"→100円固定  /  他→0',
    'col136 [トラブル]報酬:  トラブル担当[col112]=""→0  /  担当≠"谷澤"→500円固定  /  他→0',
    'col137 売上原価:        [col2]="キャンセル"→0  /  他→ SUM(col127〜col131)',
    '                        = 仕入れ費用+仕入れ送料+PayPal手数料+WISE手数料+外注費用',
    'col138 売上原価率:      [col2]="キャンセル"→0  /  他→ 売上原価[col137]÷売上高[col126]  (0除算→空)',
    'col139 売上総利益:      [col2]="キャンセル"→0  /  他→ 売上高[col126]-売上原価[col137]',
    'col140 売上純利益率:    [col2]="キャンセル"→0  /  他→ 売上総利益[col139]÷売上高[col126]',
    'col141 (列名なし):      入力（常に空）',
    'col142 荷造運賃:        [col2]="キャンセル"→0  /  他→ 見積もり送料[col81]',
    'col143 広告費:          入力（常に空）',
    'col144 返送料:          トラブル情報返送料[col121]をそのまま参照',
    'col145 返金額:          トラブル情報返金額[col117]をそのまま参照',
    'col146 インセンティブ計算用: [col2]="キャンセル"→0  /  他→ 売上高[col126]−(各種費用の複合式) ※数式全文はSection1参照',
    'col147 営業利益:        [col1]≠"キャンセル"→ col126−col127−col128−col130−col131−col142−col143',
    '                        ★注意①: PayPal手数料[col129]は営業利益に含まれない (売上原価[col137]には含まれる不整合)',
    '                        ★注意②: 条件がA61([col1])参照。他のほとんどはB61([col2])参照',
    'col148 営業利益率:      [col2]="キャンセル"→0  /  他→ 営業利益[col147]÷売上高[col126]',
    'col149 消費税還付込:    [col2]="キャンセル"→0  /  他→ 営業利益[col147]+消費税還[col150]',
    'col150 消費税還:        [col1]≠"キャンセル"→ ROUND(仕入れ費用[col127]÷11, 0)',
    'col151 営業利益率(消費税還付込): [col2]="キャンセル"→0  /  他→ 消費税還付込[col149]÷売上高[col126]',
  ];
  specs.forEach(function(s) { lines.push(s); });
  lines.push('');

  // ============================================================
  // Section 4: 再計算照合（651行）
  // ============================================================
  lines.push('--- Section4: 再計算照合（651行）---');
  lines.push('中間値(col127〜131, col142, col143)はシートの値を使用');
  lines.push('');

  var res126 = { match: 0, miss: [] };
  var res137 = { match: 0, miss: [] };
  var res147 = { match: 0, miss: [] };

  for (var r = 0; r < nRows; r++) {
    var row = data[r];
    var sr = DATA_START + r;
    var statA = String(row[0] || '').trim(); // col1
    var statB = String(row[1] || '').trim(); // col2

    // --- col126 売上高: IF(B="キャンセル",0,(O*K)+R) ---
    var shSales  = toNum(row[125]); // col126
    var calcSales = statB === 'キャンセル'
      ? 0
      : toNum(row[10]) * toNum(row[14]) + toNum(row[17]); // K*O+R = col11*col15+col18
    if (Math.abs(shSales - calcSales) < 0.01) {
      res126.match++;
    } else {
      res126.miss.push('row' + sr + ' | シート=' + shSales + ' | 計算=' + calcSales + ' | 差額=' + (shSales - calcSales));
    }

    // --- col137 売上原価: IF(B="キャンセル",0,SUM(DW:EA)) = SUM(col127〜131) ---
    var shCost   = toNum(row[136]); // col137
    var pyFee    = toNum(row[128]); // col129 PayPal手数料（文字列"0"→0に変換済み）
    var calcCost = statB === 'キャンセル'
      ? 0
      : toNum(row[126]) + toNum(row[127]) + pyFee + toNum(row[129]) + toNum(row[130]);
      // col127       col128          col129    col130          col131
    if (Math.abs(shCost - calcCost) < 0.01) {
      res137.match++;
    } else {
      res137.miss.push('row' + sr + ' | シート=' + shCost + ' | 計算=' + calcCost + ' | 差額=' + (shCost - calcCost)
        + ' | 内訳: 仕入=' + toNum(row[126]) + ' 仕入送=' + toNum(row[127]) + ' PayPal=' + pyFee + ' WISE=' + toNum(row[129]) + ' 外注=' + toNum(row[130]));
    }

    // --- col147 営業利益: IF(A<>"キャンセル",DV-DW-DX-DZ-EA-EL-EM,0) ---
    // = col126-127-128-130-131-142-143  (col129 PayPalは含まない)
    var shProfit   = toNum(row[146]); // col147
    var calcProfit = statA === 'キャンセル'
      ? 0
      : toNum(row[125]) - toNum(row[126]) - toNum(row[127])
        - toNum(row[129]) - toNum(row[130])
        - toNum(row[141]) - toNum(row[142]);
      // DV(col126) -DW(col127) -DX(col128) -DZ(col130) -EA(col131) -EL(col142) -EM(col143)
    if (Math.abs(shProfit - calcProfit) < 0.01) {
      res147.match++;
    } else {
      res147.miss.push('row' + sr + ' | シート=' + shProfit + ' | 計算=' + calcProfit + ' | 差額=' + (shProfit - calcProfit)
        + ' | 内訳: 売上=' + toNum(row[125]) + ' 仕入=' + toNum(row[126]) + ' 仕入送=' + toNum(row[127]) + ' WISE=' + toNum(row[129]) + ' 外注=' + toNum(row[130]) + ' 荷=' + toNum(row[141]) + ' 広=' + toNum(row[142]));
    }
  }

  lines.push('【col126 売上高: (単価×数量+送料) or 0】');
  lines.push('一致: ' + res126.match + '/651 / 不一致: ' + res126.miss.length + '件');
  res126.miss.forEach(function(m) { lines.push('  ' + m); });
  lines.push('');

  lines.push('【col137 売上原価: SUM(col127〜131) or 0】');
  lines.push('一致: ' + res137.match + '/651 / 不一致: ' + res137.miss.length + '件');
  res137.miss.forEach(function(m) { lines.push('  ' + m); });
  lines.push('');

  lines.push('【col147 営業利益: col126-127-128-130-131-142-143 or 0】');
  lines.push('一致: ' + res147.match + '/651 / 不一致: ' + res147.miss.length + '件');
  res147.miss.forEach(function(m) { lines.push('  ' + m); });
  lines.push('');

  lines.push('=== 調査完了 ===');
  var result = lines.join('\n');
  Logger.log(result);
  return result;
}
