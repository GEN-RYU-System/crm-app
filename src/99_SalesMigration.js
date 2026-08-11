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

// ============================================================
// Phase3: 発送先突合（売上データ vs オーダー管理/配送先マスタ）
// 読み取り専用・書き込みなし
// ============================================================
function auditShippingMatch() {
  var ss = getSpreadsheet();
  var lines = ['=== Phase3: 発送先突合 ===', ''];

  // ── 売上データ ──
  var sdSheet = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  if (!sdSheet) { lines.push('[ERROR] シートが見つかりません: ' + CONFIG.SHEETS.SALES_DATA); Logger.log(lines.join('\n')); return lines.join('\n'); }
  var DATA_START = 61;
  var N_ROWS     = 651;
  // col1-39 (idx0-38): country(col39/idx38) が最終
  var sdData = sdSheet.getRange(DATA_START, 1, N_ROWS, 39).getValues();

  // ── オーダー管理 ──
  var omSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  if (!omSheet) { lines.push('[ERROR] シートが見つかりません: ' + CONFIG.SHEETS.ORDER_MASTER); Logger.log(lines.join('\n')); return lines.join('\n'); }
  var omLast = omSheet.getLastRow();
  var omData  = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 4).getValues() : [];
  // OM 0-based: odId=0, inv=1, ctId=2, adId=3
  var omMap = {};  // baseInvNo → {odId, ctId, adId}
  omData.forEach(function(r) {
    var inv  = String(r[1] || '').trim();
    if (!inv) return;
    var base = inv.replace(/-\d+$/, '');
    if (!omMap[base]) omMap[base] = { odId: String(r[0] || '').trim(), ctId: String(r[2] || '').trim(), adId: String(r[3] || '').trim() };
  });

  // ── 配送先マスタ ──
  var adSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  if (!adSheet) { lines.push('[ERROR] シートが見つかりません: ' + CONFIG.SHEETS.CRM_SHIPPING); Logger.log(lines.join('\n')); return lines.join('\n'); }
  var adLast = adSheet.getLastRow();
  var adData  = adLast >= 2 ? adSheet.getRange(2, 1, adLast - 1, 11).getValues() : [];
  // AD 0-based: adId=0, ctId=1, name=2, a1=3, a2=4, a3=5, city=6, state=7, zip=8, country=9, phone=10
  var adMap = {};  // adId → row
  adData.forEach(function(r) {
    var id = String(r[0] || '').trim();
    if (id) adMap[id] = r;
  });

  // ── 顧客マスタ ──
  var ctSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  if (!ctSheet) { lines.push('[ERROR] シートが見つかりません: ' + CONFIG.SHEETS.CRM_CUSTOMERS); Logger.log(lines.join('\n')); return lines.join('\n'); }
  var ctLast = ctSheet.getLastRow();
  var ctData  = ctLast >= 2 ? ctSheet.getRange(2, 1, ctLast - 1, 3).getValues() : [];
  // CT 0-based: ctId=0, custName=2
  var ctMap = {};
  ctData.forEach(function(r) {
    var id = String(r[0] || '').trim();
    if (id) ctMap[id] = String(r[2] || '').trim();
  });

  // ── フィルタ: col29(idx28)受取人 または col33(idx32)住所1 に値あり ──
  var targets = [];
  sdData.forEach(function(row, idx) {
    var recip = String(row[28] || '').trim();
    var addr1 = String(row[32] || '').trim();
    if (recip || addr1) targets.push({ row: row, sdRow: DATA_START + idx });
  });
  lines.push('対象行数（col29 or col33 に値あり）: ' + targets.length + '件');
  lines.push('OM登録済みオーダー数: ' + Object.keys(omMap).length);
  lines.push('配送先マスタ件数: ' + Object.keys(adMap).length);
  lines.push('');

  // ── 正規化ヘルパー ──
  function norm(s) {
    s = String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    var abbr = { 'st.': 'street', 'ave.': 'avenue', 'blvd.': 'boulevard',
                 'rd.': 'road', 'dr.': 'drive', 'ln.': 'lane', 'ct.': 'court',
                 'pl.': 'place', 'apt.': 'apartment', 'ste.': 'suite' };
    Object.keys(abbr).forEach(function(k) { s = s.split(k).join(abbr[k]); });
    return s.trim();
  }

  function cmp(sdVal, adVal) {
    var sd = String(sdVal || '').trim();
    var ad = String(adVal || '').trim();
    if (sd === '' && ad === '') return 'BOTH_EMPTY';
    if (sd === '' && ad !== '') return 'SD_EMPTY';
    if (sd !== '' && ad === '') return 'AD_EMPTY';
    if (sd === ad)              return 'EXACT';
    if (norm(sd) === norm(ad))  return 'TYPO';
    return 'MISMATCH';
  }

  // ── 行ごと突合 ──
  var stats = { total: targets.length, exact: 0, typo: 0, sdPartial: 0, mismatch: 0, noOrder: 0, noAd: 0 };
  var mismatchOdSet = {};
  var mismatchCtSet = {};
  var detLines = [];

  targets.forEach(function(item) {
    var row   = item.row;
    var sdRow = item.sdRow;

    // SD shipping fields (0-based)
    var sdInvNo   = String(row[11] || '').trim(); // col12: 請求書番号
    var sdRecip   = String(row[28] || '').trim(); // col29: 受取人
    var sdPhone   = String(row[29] || '').trim(); // col30: 電話
    var sdAddr1   = String(row[32] || '').trim(); // col33: 住所1
    var sdAddr2   = String(row[33] || '').trim(); // col34: 住所2
    var sdCity    = String(row[35] || '').trim(); // col36: 都市
    var sdState   = String(row[36] || '').trim(); // col37: 州
    var sdZip     = String(row[37] || '').trim(); // col38: ZIP
    var sdCountry = String(row[38] || '').trim(); // col39: 国

    // OM lookup
    var baseInv = sdInvNo.replace(/-\d+$/, '');
    var om = omMap[baseInv];
    if (!om) {
      stats.noOrder++;
      detLines.push('row' + sdRow + ' [NoOrder] inv=' + sdInvNo + ' 受取人=' + sdRecip);
      return;
    }

    var odId     = om.odId;
    var ctId     = om.ctId;
    var adId     = om.adId;
    var custName = ctMap[ctId] || '(不明)';

    // AD lookup
    var ad = adMap[adId];
    if (!ad) {
      stats.noAd++;
      detLines.push('row' + sdRow + ' [NoAD] inv=' + sdInvNo + ' ' + odId + '/' + adId + ' cust=' + custName);
      return;
    }

    // Compare 8 fields
    var fieldDefs = [
      { label: '受取人', sd: sdRecip,   ad: String(ad[2]  || '') },
      { label: '住所1',  sd: sdAddr1,   ad: String(ad[3]  || '') },
      { label: '住所2',  sd: sdAddr2,   ad: String(ad[4]  || '') },
      { label: '都市',   sd: sdCity,    ad: String(ad[6]  || '') },
      { label: '州',     sd: sdState,   ad: String(ad[7]  || '') },
      { label: 'ZIP',    sd: sdZip,     ad: String(ad[8]  || '') },
      { label: '国',     sd: sdCountry, ad: String(ad[9]  || '') },
      { label: '電話',   sd: sdPhone,   ad: String(ad[10] || '') }
    ];

    var hasMismatch = false, hasTypo = false, hasSdEmpty = false;
    var anomalyParts = [];
    fieldDefs.forEach(function(f) {
      var r = cmp(f.sd, f.ad);
      if (r === 'MISMATCH') {
        hasMismatch = true;
        anomalyParts.push(f.label + ':MISMATCH(SD="' + f.sd + '" AD="' + f.ad + '")');
      } else if (r === 'TYPO') {
        hasTypo = true;
        anomalyParts.push(f.label + ':TYPO(SD="' + f.sd + '" AD="' + f.ad + '")');
      } else if (r === 'SD_EMPTY') {
        hasSdEmpty = true;
        anomalyParts.push(f.label + ':SD_EMPTY(AD="' + f.ad + '")');
      } else if (r === 'AD_EMPTY') {
        anomalyParts.push(f.label + ':AD_EMPTY(SD="' + f.sd + '")');
      }
    });

    var judgment;
    if (hasMismatch) {
      judgment = '不一致';
      stats.mismatch++;
      mismatchOdSet[odId] = true;
      mismatchCtSet[ctId] = true;
    } else if (hasTypo) {
      judgment = '表記ゆれ';
      stats.typo++;
    } else if (hasSdEmpty) {
      judgment = '一致(SD欠損あり)';
      stats.sdPartial++;
    } else {
      judgment = '一致';
      stats.exact++;
    }

    var suffix = anomalyParts.length > 0 ? ' | ' + anomalyParts.join(' / ') : '';
    detLines.push('row' + sdRow + ' [' + judgment + '] inv=' + sdInvNo + ' ' + odId + '/' + adId + ' cust=' + custName + suffix);
  });

  // ── 出力 ──
  lines.push('--- 詳細 ---');
  detLines.forEach(function(l) { lines.push(l); });
  lines.push('');
  lines.push('--- 集計 ---');
  lines.push('対象合計:                 ' + stats.total);
  lines.push('一致:                     ' + stats.exact);
  lines.push('一致(SD欠損あり):         ' + stats.sdPartial);
  lines.push('表記ゆれ:                 ' + stats.typo);
  lines.push('不一致:                   ' + stats.mismatch);
  lines.push('  うち不一致オーダー数:   ' + Object.keys(mismatchOdSet).length);
  lines.push('  うち不一致顧客数:       ' + Object.keys(mismatchCtSet).length);
  lines.push('NoOrder（OM未登録）:       ' + stats.noOrder);
  lines.push('NoAD（配送先マスタ未登録）: ' + stats.noAd);
  lines.push('');
  lines.push('=== 調査完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// row624 調査: 請求書番号が空の行が OM に存在するか
// ============================================================
function checkRow624() {
  var ss = getSpreadsheet();
  var lines = ['=== row624 調査 ===', ''];

  var sdSheet = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  // col1-80: 取引先名(col6)・運送状番号(col80)まで取得
  var sdRow = sdSheet.getRange(624, 1, 1, 80).getValues()[0];

  lines.push('--- row624 主要フィールド ---');
  lines.push('col1  ステータス:   ' + sdRow[0]);
  lines.push('col2  トラブル:     ' + sdRow[1]);
  lines.push('col6  取引先名:     ' + sdRow[5]);
  lines.push('col12 請求書番号:   "' + sdRow[11] + '"');
  lines.push('col29 受取人:       ' + sdRow[28]);
  lines.push('col30 電話:         ' + sdRow[29]);
  lines.push('col33 住所1:        ' + sdRow[32]);
  lines.push('col36 都市:         ' + sdRow[35]);
  lines.push('col39 国:           ' + sdRow[38]);
  lines.push('col79 発送日:       ' + sdRow[78]);
  lines.push('col80 運送状番号:   "' + sdRow[79] + '"');
  lines.push('');

  var custName = String(sdRow[5]  || '').trim();
  var tracking  = String(sdRow[79] || '').trim();

  // CT から顧客ID取得
  var ctSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  var ctLast  = ctSheet.getLastRow();
  var ctData  = ctLast >= 2 ? ctSheet.getRange(2, 1, ctLast - 1, 3).getValues() : [];
  var matchCtIds = [];
  ctData.forEach(function(r) {
    if (String(r[2] || '').trim() === custName) matchCtIds.push(String(r[0] || '').trim());
  });
  lines.push('取引先名 "' + custName + '" に対応するCT-ID: ' + (matchCtIds.length > 0 ? matchCtIds.join(', ') : 'なし'));
  lines.push('運送状番号: "' + tracking + '"');
  lines.push('');

  // OM を顧客ID または 運送状番号で検索
  var omSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var omLast  = omSheet.getLastRow();
  var omData  = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 22).getValues() : [];
  // OM 0-based: odId=0, inv=1, ctId=2, adId=3, status=6, tracking=21

  var found = [];
  omData.forEach(function(r, idx) {
    var ctId      = String(r[2]  || '').trim();
    var omTracking = String(r[21] || '').trim();
    var byCt      = matchCtIds.indexOf(ctId) >= 0;
    var byTrack   = tracking !== '' && omTracking === tracking;
    if (byCt || byTrack) {
      found.push('OMrow' + (idx + 2) + ' odId=' + String(r[0] || '').trim()
        + ' inv=' + String(r[1] || '').trim()
        + ' ctId=' + ctId
        + ' adId=' + String(r[3] || '').trim()
        + ' status=' + String(r[6] || '').trim()
        + ' tracking=' + omTracking
        + ' [by: ' + (byCt ? 'ctId' : '') + (byTrack ? ' tracking' : '') + ']');
    }
  });

  lines.push('--- OM検索結果 ---');
  if (found.length === 0) {
    lines.push('OM一致なし → 移行漏れの疑い');
  } else {
    found.forEach(function(l) { lines.push(l); });
  }

  lines.push('');
  lines.push('=== 調査完了 ===');
  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// ARSEL SLU 別発送先 DRY_RUN
//   住所A (#0909/#0911用): Endika Perez Alonso スペイン住所
//   住所B (#0914/#0915用): N-145 Km.9 / La Farga de Moles / Lleida
// ============================================================
function addArselShippingDryRun() {
  var ss = getSpreadsheet();
  var lines = ['=== ARSEL SLU 別発送先 DRY_RUN ===', ''];

  // ── SD実値読み取り ──
  // 住所A: row625 (#0909-1 の1行目)
  // 住所B: row651 (#0914-01 の1行目)
  var sdSheet = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  var sdA = sdSheet.getRange(625, 1, 1, 39).getValues()[0];
  var sdB = sdSheet.getRange(651, 1, 1, 39).getValues()[0];

  function extractAddr(row) {
    return {
      recip:   String(row[28] || '').trim(), // col29
      phone:   String(row[29] || '').trim(), // col30
      addr1:   String(row[32] || '').trim(), // col33
      addr2:   String(row[33] || '').trim(), // col34
      addr3:   String(row[34] || '').trim(), // col35
      city:    String(row[35] || '').trim(), // col36
      state:   String(row[36] || '').trim(), // col37
      zip:     String(row[37] || '').trim(), // col38
      country: String(row[38] || '').trim()  // col39
    };
  }

  var addrA = extractAddr(sdA);
  var addrB = extractAddr(sdB);

  lines.push('--- SD実値確認 ---');
  lines.push('【住所A: row625(#0909-1)】');
  Object.keys(addrA).forEach(function(k) { lines.push('  ' + k + ': "' + addrA[k] + '"'); });
  lines.push('【住所B: row651(#0914-01)】');
  Object.keys(addrB).forEach(function(k) { lines.push('  ' + k + ': "' + addrB[k] + '"'); });
  lines.push('');

  // ── 国番号・電話分離 ──
  // 先頭に国番号が付いていれば分離する（3桁→2桁→1桁の順で試行）
  function splitPhone(phone) {
    if (!phone) return { national: '', cc: '' };
    // 試行順: 376(Andorra), 34(Spain), 81(Japan), 1(US) 等
    var ccList = ['376', '81', '34', '44', '33', '49', '86', '82', '61', '55', '52', '39', '31', '1'];
    for (var i = 0; i < ccList.length; i++) {
      if (phone.indexOf(ccList[i]) === 0) {
        return { cc: ccList[i], national: phone.slice(ccList[i].length) };
      }
    }
    return { cc: '', national: phone };
  }

  var phoneA = splitPhone(addrA.phone);
  var phoneB = splitPhone(addrB.phone);

  lines.push('--- 電話分離 ---');
  lines.push('住所A raw="' + addrA.phone + '" → cc="' + phoneA.cc + '" national="' + phoneA.national + '"');
  lines.push('住所B raw="' + addrB.phone + '" → cc="' + phoneB.cc + '" national="' + phoneB.national + '"');
  lines.push('');

  // ── 配送先マスタから現在の最大ADと ARSEL SLU の ctId 取得 ──
  var adSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  var adLast  = adSheet.getLastRow();
  var adData  = adLast >= 2 ? adSheet.getRange(2, 1, adLast - 1, 16).getValues() : [];

  var maxAdNum = 0;
  var arselCtId = '';
  adData.forEach(function(r) {
    var id = String(r[0] || '').trim();
    if (id === 'AD-00050') arselCtId = String(r[1] || '').trim();
    var m = id.match(/^AD-(\d+)$/);
    if (m) { var n = parseInt(m[1], 10); if (n > maxAdNum) maxAdNum = n; }
  });

  var newAdIdA = 'AD-' + ('00000' + (maxAdNum + 1)).slice(-5);
  var newAdIdB = 'AD-' + ('00000' + (maxAdNum + 2)).slice(-5);

  lines.push('ARSEL SLU ctId: ' + arselCtId);
  lines.push('現在の最大AD番号: AD-' + ('00000' + maxAdNum).slice(-5));
  lines.push('住所A 新ID: ' + newAdIdA);
  lines.push('住所B 新ID: ' + newAdIdB);
  lines.push('');

  // 住所B の受取人が空なら ARSEL SLU をデフォルト
  var recipB = addrB.recip !== '' ? addrB.recip : 'ARSEL SLU';

  // ── 16列行を生成 ──
  // 配送先ID(1) 顧客ID(2) 宛名(3) Addr1(4) Addr2(5) Addr3(6)
  // City(7) State(8) Zip(9) 国(10) 電話(11) 国番号(12)
  // D Email(13) D Tax ID(14) 既定(15) 有効(16)
  var newRowA = [
    newAdIdA, arselCtId, addrA.recip,
    addrA.addr1, addrA.addr2, addrA.addr3,
    addrA.city, addrA.state, addrA.zip, addrA.country,
    phoneA.national, phoneA.cc,
    '', '', false, false
  ];

  var newRowB = [
    newAdIdB, arselCtId, recipB,
    addrB.addr1, addrB.addr2, addrB.addr3,
    addrB.city, addrB.state, addrB.zip, addrB.country,
    phoneB.national, phoneB.cc,
    '', '', false, false
  ];

  var colNames = [
    '配送先ID','顧客ID','宛名','Address 1','Address 2','Address 3',
    'City','State','Zip','国','電話','国番号',
    'D Email','D Tax ID','既定','有効'
  ];

  function fmtRow(label, id, row) {
    var out = ['【' + label + ': ' + id + '】'];
    row.forEach(function(v, i) {
      out.push('  col' + (i + 1) + ' ' + colNames[i] + ': "' + v + '"');
    });
    return out.join('\n');
  }

  lines.push('--- DRY_RUN: 追加行（書き込みなし）---');
  lines.push(fmtRow('住所A', newAdIdA, newRowA));
  lines.push('');
  lines.push(fmtRow('住所B', newAdIdB, newRowB));
  lines.push('');

  // ── 対象オーダーの配送先ID付け替え before/after ──
  var targetMap = {};
  targetMap['#0909'] = { newAdId: newAdIdA, label: '住所A' };
  targetMap['#0911'] = { newAdId: newAdIdA, label: '住所A' };
  targetMap['#0914'] = { newAdId: newAdIdB, label: '住所B' };
  targetMap['#0915'] = { newAdId: newAdIdB, label: '住所B' };

  var omSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var omLast  = omSheet.getLastRow();
  var omData  = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 4).getValues() : [];

  lines.push('--- DRY_RUN: 配送先ID付け替え before/after ---');
  var updates = [];
  omData.forEach(function(r, idx) {
    var odId  = String(r[0] || '').trim();
    var inv   = String(r[1] || '').trim();
    var adId  = String(r[3] || '').trim();
    var baseInv = inv.replace(/-\d+$/, '');
    var target = targetMap[baseInv];
    if (target) {
      updates.push({
        omRow: idx + 2,
        odId:  odId,
        inv:   inv,
        before: adId,
        after:  target.newAdId,
        label:  target.label
      });
      lines.push('OMrow' + (idx + 2) + ' ' + odId + ' inv=' + inv + ' [' + target.label + '] ' + adId + ' → ' + target.newAdId);
    }
  });

  if (updates.length === 0) lines.push('対象オーダーが見つかりません（OM内の請求書番号形式を確認）');

  lines.push('');
  lines.push('--- 件数サマリ ---');
  lines.push('付け替え対象: ' + updates.length + 'オーダー');
  lines.push('  住所A(' + newAdIdA + '): ' + updates.filter(function(u) { return u.label === '住所A'; }).length + '件');
  lines.push('  住所B(' + newAdIdB + '): ' + updates.filter(function(u) { return u.label === '住所B'; }).length + '件');
  lines.push('');
  lines.push('=== DRY_RUN完了 (書き込みなし) ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// Phase5-A: 担当者・仕入れ列・進捗フラグ・個口分析（読み取り専用）
// ============================================================
function auditSalesStaffAndProgress() {
  var ss = getSpreadsheet();
  var lines = ['=== Phase5-A: 担当者・仕入れ・進捗・個口 調査 ===', ''];

  var sdSheet = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  if (!sdSheet) {
    lines.push('[ERROR] ' + CONFIG.SHEETS.SALES_DATA + ' が見つかりません');
    Logger.log(lines.join('\n'));
    return lines.join('\n');
  }

  var DATA_START = 61;
  var N_ROWS     = 651;

  // ── データ読み込み ──
  // RangeA: col1-12  → invNo(col12=idx11), 受注担当(col4=idx3), 営業担当(col5=idx4)
  var rA = sdSheet.getRange(DATA_START, 1,  N_ROWS, 12).getValues();
  // RangeB: col40-56 → 発送担当(col40=idx0), 検品(col41=idx1), 箱数(col48=idx8),
  //                     梱包(col49=idx9), ラベル発行(col56=idx16)
  var rB = sdSheet.getRange(DATA_START, 40, N_ROWS, 17).getValues();
  // RangeC: col80-87 → 運送状番号(col80=idx0), 格納(col82=idx2), 集荷依頼(col83=idx3),
  //                     通知(col85=idx5), 仕入れ担当(col87=idx7)
  var rC = sdSheet.getRange(DATA_START, 80, N_ROWS, 8).getValues();
  // RangeD: col92-94 → 金額(col92=idx0), 数量(col93=idx1), 総額(col94=idx2)
  var rD  = sdSheet.getRange(DATA_START, 92, N_ROWS, 3).getValues();
  var rDF = sdSheet.getRange(DATA_START, 92, N_ROWS, 3).getFormulas();

  // ── Section1: 担当者名 ──
  var staffTally = {}; // name → {count, cols[]}
  function tally(name, col) {
    var n = String(name || '').trim();
    if (!n) return;
    if (!staffTally[n]) staffTally[n] = { count: 0, cols: [] };
    staffTally[n].count++;
    if (staffTally[n].cols.indexOf(col) < 0) staffTally[n].cols.push(col);
  }
  for (var r = 0; r < N_ROWS; r++) {
    tally(rA[r][3],  'col4');   // 受注担当
    tally(rA[r][4],  'col5');   // 営業担当
    tally(rB[r][0],  'col40');  // 発送担当
    tally(rC[r][7],  'col87');  // 仕入れ担当
  }

  // 担当者マスタ読み込み
  var staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  var empList = [];
  var empMap  = {}; // 各種フル名 → empId

  if (staffSheet && staffSheet.getLastRow() >= 2) {
    var staffData = staffSheet.getRange(2, 1, staffSheet.getLastRow() - 1, 5).getValues();
    // col1=EMP-ID, col2=苗字JP, col3=名JP, col4=苗字EN, col5=名EN
    staffData.forEach(function(sr) {
      var empId   = String(sr[0] || '').trim();
      var lastJp  = String(sr[1] || '').trim();
      var firstJp = String(sr[2] || '').trim();
      var lastEn  = String(sr[3] || '').trim();
      var firstEn = String(sr[4] || '').trim();
      var fJp    = lastJp + firstJp;
      var fJpSp  = (lastJp + ' ' + firstJp).trim();
      var fEn    = (firstEn + ' ' + lastEn).trim();
      var fEnR   = (lastEn + ' ' + firstEn).trim();
      empList.push({ empId: empId, jp: fJp, en: fEn });
      [fJp, fJpSp, fEn, fEnR, firstJp, firstEn].forEach(function(n) {
        if (n && !empMap[n]) empMap[n] = empId;
      });
    });
  }

  lines.push('--- Section1: 担当者名 → EMP-ID 突合 ---');
  lines.push('担当者マスタ件数: ' + empList.length);
  lines.push('【担当者マスタ一覧】');
  empList.forEach(function(e) {
    lines.push('  ' + e.empId + ': JP=' + e.jp + ' / EN=' + e.en);
  });
  lines.push('');
  lines.push('【売上データ ユニーク担当者名（出現数つき）】');
  var unmatched = [];
  Object.keys(staffTally).sort().forEach(function(name) {
    var st    = staffTally[name];
    var empId = empMap[name] || '';
    var tag   = empId ? '[OK] ' + empId : '[MISMATCH]';
    lines.push('  ' + tag + ' "' + name + '" 計' + st.count + '件 cols=' + st.cols.join('/'));
    if (!empId) unmatched.push('"' + name + '"');
  });
  lines.push('');
  lines.push('不一致: ' + unmatched.length + '件'
    + (unmatched.length > 0 ? ' → ' + unmatched.join(', ') : ''));
  lines.push('');

  // ── Section2: 仕入れ情報 col92/93/94 数式 vs 入力 ──
  lines.push('--- Section2: 仕入れ情報 数式 vs 入力 ---');
  var colLabels = ['col92(金額)', 'col93(数量)', 'col94(総額)'];
  for (var c = 0; c < 3; c++) {
    var fmtCnt = 0, inpCnt = 0, emptyCnt = 0;
    var fmtEx  = [];
    for (var ri = 0; ri < N_ROWS; ri++) {
      var fm  = String(rDF[ri][c] || '');
      var val = rD[ri][c];
      if (fm) {
        fmtCnt++;
        if (fmtEx.length < 3) fmtEx.push('row' + (DATA_START + ri) + ': ' + fm);
      } else if (val !== '' && val !== null && val !== undefined) {
        inpCnt++;
      } else {
        emptyCnt++;
      }
    }
    lines.push(colLabels[c] + ': 数式=' + fmtCnt + ' / 入力=' + inpCnt + ' / 空=' + emptyCnt);
    if (fmtEx.length > 0) lines.push('  数式例: ' + fmtEx.join(' | '));
  }
  lines.push('');

  // ── Section3: 進捗フラグ値分布 ──
  lines.push('--- Section3: 進捗フラグ値分布 ---');
  var flagDefs = [
    { label: 'col41 検品',       get: function(r) { return rB[r][1];  } },
    { label: 'col49 梱包',       get: function(r) { return rB[r][9];  } },
    { label: 'col82 格納',       get: function(r) { return rC[r][2];  } },
    { label: 'col83 集荷依頼',   get: function(r) { return rC[r][3];  } },
    { label: 'col85 通知',       get: function(r) { return rC[r][5];  } },
    { label: 'col56 ラベル発行', get: function(r) { return rB[r][16]; } }
  ];
  flagDefs.forEach(function(def) {
    var dist = {};
    for (var ri = 0; ri < N_ROWS; ri++) {
      var v = def.get(ri);
      var key = (v === '' || v === null || v === undefined) ? '(空)' : '"' + String(v) + '"';
      dist[key] = (dist[key] || 0) + 1;
    }
    lines.push(def.label + ':');
    Object.keys(dist).sort().forEach(function(k) {
      lines.push('  ' + k + ': ' + dist[k] + '件');
    });
  });
  lines.push('');

  // ── Section4: 発送個口分析 ──
  lines.push('--- Section4: 発送個口分析 ---');
  // col48(箱数)=rB[r][8], col80(運送状番号)=rC[r][0], col12(invNo)=rA[r][11]
  var boxGe2 = 0;
  var orderTrk = {}; // baseInv → {trackingSet}
  for (var ri = 0; ri < N_ROWS; ri++) {
    var boxNum  = parseFloat(String(rB[ri][8] || '0')) || 0;
    if (boxNum >= 2) boxGe2++;

    var invNo   = String(rA[ri][11] || '').trim();
    var trk     = String(rC[ri][0]  || '').trim();
    var baseInv = invNo.replace(/-\d+$/, '');
    if (!baseInv) continue;

    if (!orderTrk[baseInv]) orderTrk[baseInv] = {};
    if (trk) orderTrk[baseInv][trk] = true;
  }

  var multiTrk = [];
  Object.keys(orderTrk).forEach(function(inv) {
    var cnt = Object.keys(orderTrk[inv]).length;
    if (cnt > 1) multiTrk.push({ inv: inv, cnt: cnt, trks: Object.keys(orderTrk[inv]) });
  });
  multiTrk.sort(function(a, b) { return b.cnt - a.cnt; });

  lines.push('col48(箱数)が2以上の行数: ' + boxGe2 + '行');
  lines.push('同一オーダー内に複数運送状番号が存在するオーダー数: ' + multiTrk.length);
  lines.push('最大個口数: ' + (multiTrk.length > 0 ? multiTrk[0].cnt : 0));
  if (multiTrk.length > 0) {
    lines.push('【複数個口オーダー】');
    multiTrk.forEach(function(o) {
      lines.push('  baseInv=' + o.inv + ' 個口=' + o.cnt + ' 運送状: ' + o.trks.join(' / '));
    });
  }
  lines.push('');
  lines.push('=== 調査完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// ARSEL SLU 別発送先 CONFIRM（書き込み）
//   住所A 国番号修正: "" → "376"（367830はアンドラ番号376-367830と一致）
// ============================================================
function addArselShippingConfirm() {
  var ss = getSpreadsheet();
  var lines = ['=== ARSEL SLU 別発送先 CONFIRM ===', ''];

  // ─── 配送先マスタへ2行追加 ───
  var adSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
  var adLast  = adSheet.getLastRow();
  lines.push('追加前 配送先マスタ データ行数: ' + (adLast - 1));

  // 住所A: AD-00052（#0909/#0911用）国番号=376
  var newRowA = [
    'AD-00052', 'CT-00051', 'Endika Perez Alonso',
    'Carrer de la Germandat', 'de Sant Sebastia, 34', '',
    "La Seu d'Urgell", 'Lleida', '25700', 'Spain',
    '367830', '376',
    '', '', false, false
  ];
  // 住所B: AD-00053（#0914/#0915用）国番号=376
  var newRowB = [
    'AD-00053', 'CT-00051', 'ARSEL SLU',
    'N-145, Km. 9', '', '',
    'La Farga de Moles', 'Lleida', '25799', 'Spain',
    '367830', '376',
    '', '', false, false
  ];

  var rowA = adLast + 1;
  var rowB = adLast + 2;

  // '@' テキスト書式を先に設定（電話=col11, 国番号=col12）
  adSheet.getRange(rowA, 11, 2, 2).setNumberFormat('@');

  adSheet.getRange(rowA, 1, 1, 16).setValues([newRowA]);
  adSheet.getRange(rowB, 1, 1, 16).setValues([newRowB]);

  lines.push('[WRITE] 配送先マスタ row' + rowA + ': ' + newRowA[0]);
  lines.push('[WRITE] 配送先マスタ row' + rowB + ': ' + newRowB[0]);
  lines.push('');

  // ─── OM 配送先ID付け替え ───
  var omSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var omLast  = omSheet.getLastRow();
  var omData  = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 4).getValues() : [];

  var targetOdMap = {
    'OD-00161': 'AD-00052',
    'OD-00163': 'AD-00052',
    'OD-00164': 'AD-00053',
    'OD-00165': 'AD-00053'
  };

  var writeLog = [];
  omData.forEach(function(r, idx) {
    var odId    = String(r[0] || '').trim();
    var newAdId = targetOdMap[odId];
    if (newAdId) {
      var before = String(r[3] || '').trim();
      omSheet.getRange(idx + 2, 4).setValue(newAdId);
      writeLog.push('  ' + odId + ' (OMrow' + (idx + 2) + '): ' + before + ' → ' + newAdId);
    }
  });

  lines.push('[WRITE] OM 配送先ID付け替え: ' + writeLog.length + '件');
  writeLog.forEach(function(l) { lines.push(l); });
  lines.push('');

  // ─── 検証（生値で報告）───
  lines.push('--- 検証 ---');
  SpreadsheetApp.flush(); // 書き込みをフラッシュしてから読み直す

  // V1: 行数
  var adLastAfter = adSheet.getLastRow();
  var dataCount   = adLastAfter - 1;
  lines.push('V1 配送先マスタ データ行数: ' + dataCount + (dataCount === 53 ? ' [OK]' : ' [FAIL: expected 53]'));

  // V2: 新2行の全値・型
  var newRows = adSheet.getRange(rowA, 1, 2, 16).getValues();
  lines.push('V2 新2行 実値:');
  ['AD-00052', 'AD-00053'].forEach(function(expId, i) {
    var r = newRows[i];
    var phoneVal  = r[10];
    var ccVal     = r[11];
    var defVal    = r[14];
    var activeVal = r[15];
    lines.push('  ' + expId + ':');
    lines.push('    既定=' + defVal + '(' + typeof defVal + ')'
      + ' 有効=' + activeVal + '(' + typeof activeVal + ')'
      + ' [' + (defVal === false && activeVal === false ? 'OK' : 'FAIL') + ']');
    lines.push('    電話="' + phoneVal + '" type=' + typeof phoneVal
      + ' [' + (typeof phoneVal === 'string' ? 'OK' : 'FAIL') + ']');
    lines.push('    国番号="' + ccVal + '" type=' + typeof ccVal
      + ' [' + (typeof ccVal === 'string' ? 'OK' : 'FAIL') + ']');
  });

  // V3: 4オーダーの配送先ID
  var omDataAfter = omSheet.getRange(2, 1, omLast - 1, 4).getValues();
  lines.push('V3 OM 配送先ID付け替え確認:');
  var v3pass = 0;
  omDataAfter.forEach(function(r) {
    var odId     = String(r[0] || '').trim();
    var adId     = String(r[3] || '').trim();
    var expected = targetOdMap[odId];
    if (expected) {
      var ok = adId === expected;
      if (ok) v3pass++;
      lines.push('  ' + odId + ': ' + adId + (ok ? ' [OK]' : ' [FAIL: expected ' + expected + ']'));
    }
  });
  lines.push('  → ' + v3pass + '/4 [' + (v3pass === 4 ? 'OK' : 'FAIL') + ']');

  // V4: AD-00052/00053 の ctId
  var adIdCtData = adSheet.getRange(2, 1, adLastAfter - 1, 2).getValues();
  var adIdCtMap  = {};
  adIdCtData.forEach(function(r) { adIdCtMap[String(r[0] || '').trim()] = String(r[1] || '').trim(); });
  lines.push('V4 AD-00052/00053 顧客ID:');
  ['AD-00052', 'AD-00053'].forEach(function(id) {
    var ctId = adIdCtMap[id] || '(not found)';
    lines.push('  ' + id + ': ctId=' + ctId + ' [' + (ctId === 'CT-00051' ? 'OK' : 'FAIL') + ']');
  });

  // V5: CT-00051 の 既定=TRUE が AD-00050 のみ
  var adFullData = adSheet.getRange(2, 1, adLastAfter - 1, 16).getValues();
  var ct51defs = adFullData
    .filter(function(r) { return String(r[1] || '').trim() === 'CT-00051' && r[14] === true; })
    .map(function(r) { return String(r[0] || '').trim(); });
  var v5ok = ct51defs.length === 1 && ct51defs[0] === 'AD-00050';
  lines.push('V5 CT-00051 既定=TRUE: count=' + ct51defs.length + ' ids=' + ct51defs.join(',')
    + ' [' + (v5ok ? 'OK' : 'FAIL: expected 1 entry AD-00050') + ']');

  // V6: 孤児オーダー0件
  var adIdSet = {};
  adFullData.forEach(function(r) {
    var id = String(r[0] || '').trim();
    if (id) adIdSet[id] = true;
  });
  var orphans = [];
  omDataAfter.forEach(function(r) {
    var odId = String(r[0] || '').trim();
    var adId = String(r[3] || '').trim();
    if (adId && !adIdSet[adId]) orphans.push(odId + '→' + adId);
  });
  lines.push('V6 孤児オーダー: ' + orphans.length + '件'
    + (orphans.length === 0 ? ' [OK]' : ' [FAIL] ' + orphans.join(' ')));

  lines.push('');
  lines.push('=== CONFIRM完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}
