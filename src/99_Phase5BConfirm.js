// ============================================================
// Phase5-B: CONFIRM（書き込み実行）+ 8点検証
// ============================================================

/**
 * confirmPhase5B
 * - 発送タブ・仕入れタブ・OMへの実書き込み
 * - 修正4: 孤立DEP行5件の再突合
 * - ①: 「全額前払い」等の非番号文字列 → yoyakuInv 空欄・bizMemo へ転記
 * - ②: odId="" の仕入れ行もそのまま取り込み
 * - 書き込み後に 8点検証を実行
 */
function confirmPhase5B() {
  var ss   = getSpreadsheet();
  var lines = ['=== Phase5-B CONFIRM（書き込み実行）===', ''];
  var now  = new Date();
  var DATA_START = 61, N_ROWS = 651;

  // ── 安全確認: 発送/仕入れタブが空か ──
  var shpSheet = ss.getSheetByName(CONFIG.SHEETS.SHIPMENT);
  var purSheet = ss.getSheetByName(CONFIG.SHEETS.PURCHASE);
  if (!shpSheet || !purSheet) {
    lines.push('[ERROR] 発送/仕入れタブが見つかりません。setupShipmentPurchaseTabs() を先に実行してください。');
    Logger.log(lines.join('\n')); return lines.join('\n');
  }
  if (shpSheet.getLastRow() > 1) {
    lines.push('[ABORT] 発送タブに既にデータがあります（' + (shpSheet.getLastRow() - 1) + '行）。二重書き込み防止のため中止。');
    Logger.log(lines.join('\n')); return lines.join('\n');
  }
  if (purSheet.getLastRow() > 1) {
    lines.push('[ABORT] 仕入れタブに既にデータがあります（' + (purSheet.getLastRow() - 1) + '行）。二重書き込み防止のため中止。');
    Logger.log(lines.join('\n')); return lines.join('\n');
  }

  // ── 売上データ読み込み ──
  var sdSheet = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  if (!sdSheet) {
    lines.push('[ERROR] SALES_DATA not found');
    Logger.log(lines.join('\n')); return lines.join('\n');
  }
  var rA  = sdSheet.getRange(DATA_START, 1,   N_ROWS, 12).getValues();
  var rB  = sdSheet.getRange(DATA_START, 40,  N_ROWS, 17).getValues();
  var rC  = sdSheet.getRange(DATA_START, 78,  N_ROWS, 30).getValues();
  var rCF = sdSheet.getRange(DATA_START, 92,  N_ROWS,  3).getFormulas();
  var rD  = sdSheet.getRange(DATA_START, 152, N_ROWS,  1).getValues();

  // ── OM読み込み + スナップショット（書き込み前）──
  var omSheet  = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var omLast   = omSheet.getLastRow();
  var omAllBefore = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 26).getValues() : [];
  var omMap    = {};  // baseInv → odId
  var snapTargets = ['OD-00001', 'OD-00086', 'OD-00172'];
  var snapBefore  = {};

  omAllBefore.forEach(function(row) {
    var odId = String(row[0] || '').trim();
    var inv  = String(row[1] || '').trim();
    if (inv) omMap[inv.replace(/-\d+$/, '')] = odId;
    if (snapTargets.indexOf(odId) >= 0) snapBefore[odId] = row.slice();
  });
  lines.push('OM登録済みオーダー数: ' + Object.keys(omMap).length);

  // ── 発送グループ構築 ──
  var shipGroups = {};
  var anomalies  = [];

  for (var ri = 0; ri < N_ROWS; ri++) {
    var invNo   = String(rA[ri][11] || '').trim();
    var baseInv = invNo.replace(/-\d+$/, '');
    if (!baseInv) continue;
    var odId = omMap[baseInv];
    if (!odId) continue;

    var rawTrk = String(rC[ri][2] || '');
    var trk    = cleanTracking(rawTrk);

    if (!shipGroups[baseInv]) shipGroups[baseInv] = {};

    if (!trk) {
      if (!shipGroups[baseInv]['__EMPTY__'])
        shipGroups[baseInv]['__EMPTY__'] = { rowIdx: ri, isInvalid: false, cleanTrk: '', origTrk: '' };
      continue;
    }

    var valid  = isValidTracking(trk);
    var mapKey = valid ? trk : '__INVALID_' + ri + '__';
    if (valid && shipGroups[baseInv][trk]) continue;

    shipGroups[baseInv][mapKey] = { rowIdx: ri, isInvalid: !valid, cleanTrk: trk, origTrk: rawTrk };
    if (!valid) anomalies.push('無効運送状 baseInv=' + baseInv + ' trk="' + trk + '"');
  }

  // ── 発送行配列を構築（HEADERS.SHIPMENT 20列）──
  var shipRows    = [];
  var nextShipNum = 1;

  Object.keys(shipGroups).sort().forEach(function(baseInv) {
    var odId  = omMap[baseInv];
    var group = shipGroups[baseInv];
    var keys  = Object.keys(group).filter(function(k) { return k !== '__EMPTY__'; });
    if (keys.length === 0) return;

    var boxNum = 1;
    keys.forEach(function(k) {
      var entry = group[k];
      var ri    = entry.rowIdx;
      var trk   = entry.isInvalid ? '' : entry.cleanTrk;
      var memo  = String(rC[ri][8] || '').trim();
      if (entry.isInvalid && entry.cleanTrk) {
        var rawDisp = entry.origTrk.replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, '');
        memo = (memo ? memo + ' / ' : '') + '運送状原文: ' + rawDisp;
      }
      shipRows.push([
        'SHP-' + ('00000' + nextShipNum++).slice(-5), // 1: 発送ID
        odId,                                           // 2: オーダーID
        boxNum++,                                       // 3: 箱番号
        String(rC[ri][0] || '').trim(),                // 4: 発送方法
        rC[ri][1],                                      // 5: 発送日
        trk,                                            // 6: 運送状番号（'@'書式）
        String(rB[ri][3] || '').trim(),                // 7: 長さ
        String(rB[ri][4] || '').trim(),                // 8: 幅
        String(rB[ri][5] || '').trim(),                // 9: 高さ
        String(rB[ri][7] || '').trim(),                // 10: 重量
        String(rC[ri][3] || '').trim(),                // 11: 見積もり送料
        toFlag(rB[ri][1]),                             // 12: 検品
        toFlag(rB[ri][9]),                             // 13: 梱包
        toFlag(rC[ri][4]),                             // 14: 格納
        toFlag(rC[ri][5]),                             // 15: 集荷依頼
        toFlag(rC[ri][7]),                             // 16: 通知
        toEmpId(String(rB[ri][0] || '').trim()),       // 17: 発送担当ID
        memo,                                           // 18: 備考
        now,                                            // 19: 登録日
        now                                             // 20: 更新日
      ]);
    });
  });

  // ── 仕入れ行配列を構築（HEADERS.PURCHASE 17列）──
  // purRows は {arr: [...17cols], sdRow: N} のオブジェクト配列（後で备考を修正するため）
  var purObjs     = [];
  var nextPurNum  = 1;
  var purSumSkipped = [];

  for (var ri = 0; ri < N_ROWS; ri++) {
    var hasVal = false;
    for (var ci = 9; ci <= 22; ci++) {
      if (rC[ri][ci] !== '' && rC[ri][ci] !== null && rC[ri][ci] !== undefined) {
        hasVal = true; break;
      }
    }
    if (!hasVal) continue;

    var sdRow   = DATA_START + ri;
    var kinFm   = String(rCF[ri][0] || '');
    var kinVal  = rC[ri][14];

    // SUM集計行を除外（修正2）
    if (kinFm && kinFm.indexOf('SUM') >= 0) {
      purSumSkipped.push(sdRow);
      continue;
    }

    var invNo2  = String(rA[ri][11] || '').trim();
    var base2   = invNo2.replace(/-\d+$/, '');
    var odId2   = base2 ? (omMap[base2] || '') : ''; // ② odId="" 許容

    purObjs.push({
      sdRow: sdRow,
      ri:    ri,
      arr: [
        'PUR-' + ('00000' + nextPurNum++).slice(-5),     // 1: 仕入れID
        odId2,                                             // 2: オーダーID（空許容）
        toEmpId(String(rC[ri][9] || '').trim()),          // 3: 仕入れ担当ID
        rC[ri][10],                                        // 4: 注文日
        String(rC[ri][11] || '').trim(),                  // 5: 取引番号
        String(rC[ri][13] || '').trim(),                  // 6: 仕入元
        String(rC[ri][18] || '').trim(),                  // 7: 仕入元URL
        String(rC[ri][15] || '').trim(),                  // 8: 数量
        '',                                                // 9: 単価（元データなし）
        String(kinFm ? kinVal : (rC[ri][14] || '')),     // 10: 金額
        String(rC[ri][17] || '').trim(),                  // 11: 送料/代行費
        String(rC[ri][19] || '').trim(),                  // 12: 運送会社
        String(rC[ri][20] || '').trim(),                  // 13: 送り状番号（'@'書式）
        String(rC[ri][22] || '').trim(),                  // 14: ステータス
        String(rC[ri][21] || '').trim(),                  // 15: 備考
        now,                                               // 16: 登録日
        now                                                // 17: 更新日
      ]
    });
  }

  // ── 修正4: 孤立DEP行の再突合 ──
  // tracking→baseInv 逆引きマップ
  var trkToBase = {};
  Object.keys(shipGroups).forEach(function(bi) {
    Object.keys(shipGroups[bi]).forEach(function(k) {
      var e = shipGroups[bi][k];
      if (!e.isInvalid && e.cleanTrk) trkToBase[e.cleanTrk] = bi;
    });
  });

  // 孤立行 ri: row82=ri21, row116=ri55, row191=ri130, row301=ri240, row360=ri299
  var ORPHAN_RIS = [21, 55, 130, 240, 299];
  var orphanResults = [];

  ORPHAN_RIS.forEach(function(ri) {
    var trk101   = cleanTracking(String(rC[ri][2] || ''));
    var val101   = String(rC[ri][23] || '').trim();  // col101
    var sdRow    = DATA_START + ri;
    var matched  = null;
    var method   = '';

    // Try 1: tracking lookup
    if (trk101 && trkToBase[trk101]) {
      matched = trkToBase[trk101];
      method  = 'tracking';
    }

    // Try 2: adjacency（±10行以内で最近傍の非空invNo）
    if (!matched) {
      for (var delta = 1; delta <= 10 && !matched; delta++) {
        for (var sign = -1; sign <= 1 && !matched; sign += 2) {
          var ni = ri + delta * sign;
          if (ni < 0 || ni >= N_ROWS) continue;
          var adjBase = String(rA[ni][11] || '').trim().replace(/-\d+$/, '');
          if (adjBase && omMap[adjBase]) {
            matched = adjBase;
            method  = 'adjacent(Δ' + (delta * sign) + ')';
          }
        }
      }
    }

    var odId3 = matched ? omMap[matched] : '';
    orphanResults.push({
      sdRow:       sdRow,
      ri:          ri,
      val101:      val101,
      matchedBase: matched || '',
      odId:        odId3,
      method:      method || 'unmatched'
    });

    // 未突合の DEP 情報 → 仕入れ行の備考に転記
    if (!odId3 && val101) {
      purObjs.forEach(function(p) {
        if (p.sdRow === sdRow) {
          p.arr[14] = (p.arr[14] ? p.arr[14] + ' / ' : '') + 'DEP: ' + val101;
        }
      });
    }
  });

  // ── OM 追加列（col27-33）更新データ構築 ──
  var omUpdates   = {};   // odId → [col27..33]
  var processedBase = {};

  for (var ri = 0; ri < N_ROWS; ri++) {
    var invNo3  = String(rA[ri][11] || '').trim();
    var base3   = invNo3.replace(/-\d+$/, '');
    if (!base3 || processedBase[base3]) continue;
    var odId4 = omMap[base3];
    if (!odId4) continue;
    processedBase[base3] = true;

    var yoyakuInv  = String(rC[ri][23] || '').trim(); // col101
    var bizMemo    = String(rD[ri][0]  || '').trim(); // col152

    // ①: 非 #DEP 文字列 → yoyakuInv を空欄、bizMemo に原文転記
    if (yoyakuInv && !/^#DEP\s/.test(yoyakuInv)) {
      bizMemo   = (bizMemo ? bizMemo + ' / ' : '') + '予約原文: ' + yoyakuInv;
      yoyakuInv = '';
    }

    omUpdates[odId4] = [
      toEmpId(String(rA[ri][3] || '').trim()),  // col27: 受注担当ID
      toEmpId(String(rA[ri][4] || '').trim()),  // col28: 営業担当ID
      toEmpId(String(rB[ri][0] || '').trim()),  // col29: 発送担当ID
      bizMemo,                                    // col30: 取引備考欄
      yoyakuInv,                                 // col31: 予約請求書番号
      rC[ri][28],                                // col32: 発売予定日
      String(rC[ri][29] || '').trim()           // col33: デポジット率
    ];
  }

  // 修正4 突合成功行の yoyakuInv を omUpdates に反映
  orphanResults.forEach(function(o) {
    if (o.odId && o.val101 && omUpdates[o.odId]) {
      // 既存 yoyakuInv が空 かつ #DEP 形式なら上書き
      if (!omUpdates[o.odId][4] && /^#DEP\s/.test(o.val101)) {
        omUpdates[o.odId][4] = o.val101;
      }
    }
  });

  // ── 書き込み: 発送タブ ──
  if (shipRows.length > 0) {
    shpSheet.getRange(2, 1, shipRows.length, 20).setValues(shipRows);
    shpSheet.getRange(2, 6, shipRows.length, 1).setNumberFormat('@'); // 運送状番号
  }
  lines.push('[WRITE] 発送タブ: ' + shipRows.length + '行');

  // ── 書き込み: 仕入れタブ ──
  var purData = purObjs.map(function(p) { return p.arr; });
  if (purData.length > 0) {
    purSheet.getRange(2, 1, purData.length, 17).setValues(purData);
    purSheet.getRange(2, 13, purData.length, 1).setNumberFormat('@'); // 送り状番号
  }
  lines.push('[WRITE] 仕入れタブ: ' + purData.length + '行');
  lines.push('[INFO]  SUM除外行: ' + purSumSkipped.join(', '));

  // ── 書き込み: OM col27-33 ──
  var omIds = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 1).getValues() : [];
  var omCol27to33 = omIds.map(function(row) {
    var id = String(row[0] || '').trim();
    return omUpdates[id] || ['', '', '', '', '', '', ''];
  });
  if (omCol27to33.length > 0) {
    omSheet.getRange(2, 27, omCol27to33.length, 7).setValues(omCol27to33);
  }
  lines.push('[WRITE] OM col27-33: ' + omCol27to33.length + '行');
  SpreadsheetApp.flush();

  // ── 修正4 突合結果 ──
  lines.push('');
  lines.push('--- 修正4: 孤立DEP行 突合結果 ---');
  orphanResults.forEach(function(o) {
    lines.push('  row' + o.sdRow + ' val101="' + o.val101 + '" → '
      + (o.odId
        ? o.odId + ' (' + o.matchedBase + ') [' + o.method + ']'
        : '未突合 → 仕入れ備考に転記 [' + o.method + ']'));
  });

  // ── 8点検証 ──
  lines.push('');
  lines.push(_verifyPhase5B(omSheet, snapBefore, snapTargets));

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ──────────────────────────────────────────────────────
// _verifyPhase5B — 8点検証（confirmPhase5B 内から呼ぶ）
// ──────────────────────────────────────────────────────
function _verifyPhase5B(omSheet, snapBefore, snapTargets) {
  var ss   = getSpreadsheet();
  var lines = ['=== 8点検証 ==='];
  var failCount = 0;

  var shpSheet = ss.getSheetByName(CONFIG.SHEETS.SHIPMENT);
  var purSheet = ss.getSheetByName(CONFIG.SHEETS.PURCHASE);

  // ── [1] 行数 ──
  var shpCount = shpSheet.getLastRow() - 1;
  var purCount = purSheet.getLastRow() - 1;
  var chk1 = (shpCount >= 145 && shpCount <= 155 && purCount >= 490 && purCount <= 505);
  if (!chk1) failCount++;
  lines.push('[1] 発送=' + shpCount + '行 / 仕入れ=' + purCount + '行 '
    + (chk1 ? '[OK]' : '[CHECK: 想定外行数]'));

  // OM odId セット
  var omLast2 = omSheet.getLastRow();
  var omIds2  = omLast2 >= 2 ? omSheet.getRange(2, 1, omLast2 - 1, 1).getValues() : [];
  var odIdSet = {};
  omIds2.forEach(function(r) { if (r[0]) odIdSet[String(r[0]).trim()] = true; });

  // ── [2] 発送行 全odId実在 ──
  var shpOdIds  = shpCount > 0 ? shpSheet.getRange(2, 2, shpCount, 1).getValues() : [];
  var shpOrphan = shpOdIds.filter(function(r) { return !odIdSet[String(r[0] || '').trim()]; });
  var chk2 = (shpOrphan.length === 0);
  if (!chk2) failCount++;
  lines.push('[2] 発送行 孤児odId=' + shpOrphan.length + '件 ' + (chk2 ? '[OK]' : '[FAIL]'));
  shpOrphan.forEach(function(r) { lines.push('    odId="' + r[0] + '"'); });

  // ── [3] 仕入れ行 odIdが実在または空 ──
  var purOdIds = purCount > 0 ? purSheet.getRange(2, 2, purCount, 1).getValues() : [];
  var purBadId = purOdIds.filter(function(r) {
    var id = String(r[0] || '').trim();
    return id !== '' && !odIdSet[id];
  });
  var chk3 = (purBadId.length === 0);
  if (!chk3) failCount++;
  lines.push('[3] 仕入れ行 不正odId=' + purBadId.length + '件 ' + (chk3 ? '[OK]' : '[FAIL]'));
  purBadId.forEach(function(r) { lines.push('    odId="' + r[0] + '"'); });

  // ── [4] '@' テキスト書式 ──
  var shpFmts  = shpCount > 0 ? shpSheet.getRange(2, 6, shpCount, 1).getNumberFormats() : [];
  var purFmts  = purCount > 0 ? purSheet.getRange(2, 13, purCount, 1).getNumberFormats() : [];
  var shpBadFm = shpFmts.filter(function(f) { return f[0] !== '@'; }).length;
  var purBadFm = purFmts.filter(function(f) { return f[0] !== '@'; }).length;
  var chk4 = (shpBadFm === 0 && purBadFm === 0);
  if (!chk4) failCount++;
  lines.push('[4] @書式: 発送運送状非@=' + shpBadFm + ' / 仕入送り状非@=' + purBadFm
    + ' ' + (chk4 ? '[OK]' : '[FAIL]'));

  // ── [5] 進捗フラグ TRUE/FALSE のみ ──
  var flagBad = 0;
  if (shpCount > 0) {
    var flagData = shpSheet.getRange(2, 12, shpCount, 5).getValues(); // col12-16
    flagData.forEach(function(row) {
      row.forEach(function(v) { if (v !== true && v !== false) flagBad++; });
    });
  }
  var chk5 = (flagBad === 0);
  if (!chk5) failCount++;
  lines.push('[5] 進捗フラグ 非bool=' + flagBad + '件 ' + (chk5 ? '[OK]' : '[FAIL]'));

  // ── [6] 担当者ID が有効値または空 ──
  var validEmpIds = { '': true, 'EMP-00001': true, 'EMP-00002': true,
                      'EMP-00004': true, 'EMP-00007': true };
  var empBad = 0;
  // 発送 col17
  if (shpCount > 0) {
    shpSheet.getRange(2, 17, shpCount, 1).getValues().forEach(function(r) {
      if (!validEmpIds[String(r[0] || '').trim()]) empBad++;
    });
  }
  // 仕入れ col3
  if (purCount > 0) {
    purSheet.getRange(2, 3, purCount, 1).getValues().forEach(function(r) {
      if (!validEmpIds[String(r[0] || '').trim()]) empBad++;
    });
  }
  // OM col27-29
  if (omLast2 >= 2) {
    omSheet.getRange(2, 27, omLast2 - 1, 3).getValues().forEach(function(row) {
      row.forEach(function(v) {
        if (!validEmpIds[String(v || '').trim()]) empBad++;
      });
    });
  }
  var chk6 = (empBad === 0);
  if (!chk6) failCount++;
  lines.push('[6] 担当者ID 不正=' + empBad + '件 ' + (chk6 ? '[OK]' : '[FAIL]'));

  // ── [7] OM col1-26 不変（before/after 比較）──
  var chk7 = true;
  if (snapBefore && snapTargets) {
    var omAllAfter = omLast2 >= 2 ? omSheet.getRange(2, 1, omLast2 - 1, 26).getValues() : [];
    var snapAfter  = {};
    omAllAfter.forEach(function(row) {
      var id = String(row[0] || '').trim();
      if (snapTargets.indexOf(id) >= 0) snapAfter[id] = row.slice();
    });

    function toStr7(v) {
      if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd');
      return String(v === null || v === undefined ? '' : v);
    }

    var totalMM = 0;
    snapTargets.forEach(function(id) {
      var before = snapBefore[id], after = snapAfter[id];
      if (!before || !after) { lines.push('[7] ' + id + ': データなし'); return; }
      var mm = [];
      for (var i = 0; i < 26; i++) {
        if (toStr7(before[i]) !== toStr7(after[i]))
          mm.push('  col' + (i + 1) + ': "' + toStr7(before[i]) + '"→"' + toStr7(after[i]) + '"');
      }
      totalMM += mm.length;
      lines.push('[7] ' + id + ' mismatches=' + mm.length + (mm.length === 0 ? ' [OK]' : ' [FAIL]'));
      mm.forEach(function(m) { lines.push(m); });
    });
    chk7 = (totalMM === 0);
    if (!chk7) failCount++;
    lines.push('[7] 合計 mismatches=' + totalMM + ' ' + (chk7 ? '[OK]' : '[FAIL]'));
  } else {
    lines.push('[7] スナップショットなし（スキップ）');
  }

  // ── [8] 予約販売件数と内訳 ──
  var omFull = omLast2 >= 2 ? omSheet.getRange(2, 1, omLast2 - 1, 33).getValues() : [];
  var yoyakuRows = omFull.filter(function(r) { return String(r[30] || '').trim() !== ''; }); // col31=idx30
  var chk8 = (yoyakuRows.length >= 7); // 7件以上（修正4で増加する場合あり）
  if (!chk8) failCount++;
  lines.push('[8] 予約販売(col31有)=' + yoyakuRows.length + '件 ' + (chk8 ? '[OK]' : '[FAIL]'));
  yoyakuRows.forEach(function(r) {
    var rel = r[31] instanceof Date
      ? Utilities.formatDate(r[31], 'Asia/Tokyo', 'yyyy/MM/dd')
      : String(r[31] || '');
    lines.push('    ' + r[0] + ' 予約InvNo="' + r[30] + '" 発売予定=' + rel
      + ' デポジット率=' + r[32]);
  });

  // ── 総合判定 ──
  lines.push('');
  lines.push(failCount === 0
    ? '✔ 全8項目合格 → Phase5完了'
    : '✘ ' + failCount + '項目未合格 → 要確認');
  return lines.join('\n');
}

/**
 * verifyPhase5B — 単独呼び出し用ラッパー
 * （confirmPhase5B 実行済みの状態で使う）
 */
function verifyPhase5B() {
  var ss      = getSpreadsheet();
  var omSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var result  = _verifyPhase5B(omSheet, null, null);
  Logger.log(result);
  return result;
}

// ============================================================
// 修正4 予約列リセット + 正しい再突合 [WRITE]
// ============================================================
function fixOrphanDepMatchings() {
  var ss        = getSpreadsheet();
  var lines     = ['=== 修正4: 予約列リセット + 正しい再突合 ===', ''];
  var DATA_START = 61, N_ROWS = 651;

  var sdSheet = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  var omSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var shpSheet = ss.getSheetByName(CONFIG.SHEETS.SHIPMENT);
  var purSheet = ss.getSheetByName(CONFIG.SHEETS.PURCHASE);

  // ── 売上データ読み込み ──
  var rA = sdSheet.getRange(DATA_START, 1,  N_ROWS, 12).getValues();
  var rC = sdSheet.getRange(DATA_START, 78, N_ROWS, 30).getValues();

  // ── OM読み込み（全33列）──
  var omLast = omSheet.getLastRow();
  var omData = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 33).getValues() : [];
  var omRowByOdId = {};  // odId → 1-indexed sheet row
  var omByInv     = {};  // baseInv → {odId, row, sheetRow}
  omData.forEach(function(row, idx) {
    var odId = String(row[0] || '').trim();
    var inv  = String(row[1] || '').trim();
    var sheetRow = idx + 2;
    if (odId) omRowByOdId[odId] = sheetRow;
    if (inv) omByInv[inv] = { odId: odId, row: row, sheetRow: sheetRow };
  });

  // ── 取引先名 → [baseInvNo] マップ（非空invNo行のみ）──
  var custToBase = {};
  for (var ri = 0; ri < N_ROWS; ri++) {
    var inv = String(rA[ri][11] || '').trim();
    if (!inv) continue;
    var base = inv.replace(/-\d+$/, '');
    var cust = String(rA[ri][5] || '').trim();
    if (!cust || !base) continue;
    if (!custToBase[cust]) custToBase[cust] = {};
    custToBase[cust][base] = true;
  }

  function fmtD(v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd');
    return (v === '' || v === null || v === undefined) ? '（空）' : String(v);
  }

  // ════════════════════════════════════════════
  // STEP 1: col31 リセット（誤突合4件）
  // ════════════════════════════════════════════
  lines.push('--- STEP 1: col31 リセット ---');
  var RESET_ODIDS = ['OD-00014', 'OD-00030', 'OD-00094', 'OD-00108'];
  RESET_ODIDS.forEach(function(odId) {
    var sheetRow = omRowByOdId[odId];
    if (!sheetRow) { lines.push('[ERROR] ' + odId + ' OM行が見つかりません'); return; }
    var before = String(omSheet.getRange(sheetRow, 31).getValue() || '').trim();
    omSheet.getRange(sheetRow, 31).setValue('');
    lines.push('[RESET] ' + odId + ' (OM row' + sheetRow + ') col31: "' + before + '" → ""');
  });
  SpreadsheetApp.flush();
  lines.push('');

  // ════════════════════════════════════════════
  // STEP 2: 顧客名ベース再突合（row82/116/191）
  // ════════════════════════════════════════════
  lines.push('--- STEP 2: 顧客名ベース再突合 ---');
  lines.push('※ OMにsrc行番号の記録なし → 取引先名+発売予定日+DEP率で照合');
  lines.push('');

  // row82/116/191 のみ再突合試行（row301/360はユーザー判定で純粋DEP）
  var REMATCH_CASES = [
    { ri: 21,  sdRow: 82,  label: '#DEP 0005' },
    { ri: 55,  sdRow: 116, label: '#DEP 0006' },
    { ri: 130, sdRow: 191, label: '#DEP 0010' }
  ];
  var newYoyaku = []; // 確定した新規更新

  REMATCH_CASES.forEach(function(o) {
    var custName  = String(rA[o.ri][5] || '').trim();
    var oRelease  = rC[o.ri][28]; // col106
    var oDepRate  = String(rC[o.ri][29] || '').trim();
    var oVal101   = String(rC[o.ri][23] || '').trim();

    lines.push('row' + o.sdRow + ' (' + o.label + ')');
    lines.push('  取引先名: "' + custName + '"');
    lines.push('  発売予定(col106): ' + fmtD(oRelease) + ' / DEP率(col107): ' + oDepRate);

    var candidateBases = custToBase[custName] ? Object.keys(custToBase[custName]) : [];
    if (candidateBases.length === 0) {
      lines.push('  → OMに同名取引先なし → 紐付け不可（未割当DEP）');
      lines.push('');
      return;
    }

    // スコアリング（発売予定日+2 / DEP率+2 / 名前のみ+1）
    var scored = [];
    candidateBases.forEach(function(base) {
      var entry   = omByInv[base];
      if (!entry) return;
      var omRelStr  = fmtD(entry.row[31]); // col32 (idx31)
      var oRelStr   = fmtD(oRelease);
      var omDep     = String(entry.row[32] || '').trim(); // col33 (idx32)
      var score     = 1; // 名前一致ベース
      if (omRelStr !== '（空）' && omRelStr === oRelStr) score += 2;
      if (omDep !== '' && omDep === oDepRate) score += 2;
      scored.push({ base: base, odId: entry.odId, score: score,
                    omRelDate: omRelStr, omDep: omDep, sheetRow: entry.sheetRow });
    });
    scored.sort(function(a, b) { return b.score - a.score; });

    lines.push('  候補 ' + scored.length + '件:');
    scored.forEach(function(s) {
      var conf = s.score >= 5 ? '★★ 高確度' : s.score >= 3 ? '★ 中確度' : '△ 名前のみ';
      lines.push('    ' + s.odId + '(' + s.base + ')'
        + ' 発売予定=' + s.omRelDate + ' DEP率=' + s.omDep + ' [' + conf + ']');
    });

    var best = scored[0];
    if (best && best.score >= 3) {
      var current31 = String(omSheet.getRange(best.sheetRow, 31).getValue() || '').trim();
      if (!current31) {
        omSheet.getRange(best.sheetRow, 31).setValue(oVal101);
        lines.push('  [WRITE] ' + best.odId + ' col31 → "' + oVal101 + '"');
        newYoyaku.push({ odId: best.odId, val101: oVal101, conf: best.score });
      } else {
        lines.push('  [SKIP] ' + best.odId + ' col31 既に "' + current31 + '" あり');
      }
    } else {
      lines.push('  → 高確度マッチなし → col31 未更新（未割当DEPとして記録）');
    }
    lines.push('');
  });
  SpreadsheetApp.flush();

  // ════════════════════════════════════════════
  // STEP 3: row191 / OD-00053 の自己帰属確認
  // ════════════════════════════════════════════
  lines.push('--- STEP 3: row191 の帰属確認 ---');
  var ri191     = 130;
  var cust191   = String(rA[ri191][5] || '').trim();
  var release191 = fmtD(rC[ri191][28]);
  lines.push('row191 取引先: "' + cust191 + '" / 発売予定: ' + release191);

  var daveyBases = custToBase[cust191] ? Object.keys(custToBase[cust191]) : [];
  lines.push(cust191 + ' の全OMオーダー（' + daveyBases.length + '件）:');
  daveyBases.forEach(function(base) {
    var entry = omByInv[base];
    if (!entry) return;
    var relStr = fmtD(entry.row[31]);
    var match  = (relStr === release191 && release191 !== '（空）') ? ' ← 発売予定一致' : '';
    lines.push('  ' + entry.odId + '(' + base + ') 発売予定=' + relStr + ' ステータス=' + String(entry.row[6]||'') + match);
  });

  // OD-00053 自体の invNo 範囲を確認（#0808-* の行が row191 を含むか）
  var om53 = omByInv['#0808'];
  if (om53) {
    // 売上データで #0808-* の行を特定
    var rows808 = [];
    for (var ri2 = 0; ri2 < N_ROWS; ri2++) {
      var inv808 = String(rA[ri2][11] || '').trim();
      if (inv808.replace(/-\d+$/, '') === '#0808') {
        rows808.push({ sdRow: DATA_START + ri2, inv: inv808, cust: String(rA[ri2][5]||'').trim() });
      }
    }
    lines.push('OD-00053(#0808) に属する売上データ行:');
    rows808.forEach(function(r) {
      lines.push('  ' + r.sdRow + ' invNo="' + r.inv + '" 取引先="' + r.cust + '"');
    });
    lines.push('row191(空invNo)は上記に含まれず → 隣接行(row190=#0808-7)との取引先一致で紐付け');
    var selfContained = rows808.some(function(r) { return r.sdRow === 191; });
    lines.push('判定: ' + (selfContained ? 'row191 は #0808 に含まれる（自己帰属）' : 'row191 は #0808 の隣接行。同一顧客(Daveyjones)なので紐付け維持'));
  }
  lines.push('');

  // ════════════════════════════════════════════
  // STEP 4: row301 → 仕入れタブ備考にDEP転記
  // ════════════════════════════════════════════
  lines.push('--- STEP 4: row301 の仕入れタブ確認 + 備考転記 ---');
  var ri301   = 240;
  var dep301  = String(rC[ri301][23] || '').trim(); // col101
  var amt301  = rC[ri301][14]; // col92 金額
  var ord301  = rC[ri301][10]; // col88 注文日
  lines.push('row301: DEP="' + dep301 + '" 金額=' + amt301 + ' 注文日=' + fmtD(ord301));

  var purCount = purSheet.getLastRow() - 1;
  var purData301 = purCount > 0 ? purSheet.getRange(2, 1, purCount, 17).getValues() : [];
  var matchedPur301 = -1; // 0-indexed in purData301
  purData301.forEach(function(row, idx) {
    var purAmt  = String(row[9] || '').trim();  // col10 金額
    var purDate = fmtD(row[3]);                 // col4 注文日
    var purOdId = String(row[1] || '').trim();  // col2 odId
    var purMemo = String(row[14] || '').trim(); // col15 備考
    // Match by amount AND (empty odId)
    if (purOdId === '' && String(amt301 || '') === purAmt && purMemo.indexOf('DEP:') < 0) {
      matchedPur301 = idx;
    }
  });

  if (matchedPur301 >= 0) {
    var purRowNum = matchedPur301 + 2; // 1-indexed (header=1)
    var purId301  = String(purData301[matchedPur301][0] || '');
    var oldMemo   = String(purData301[matchedPur301][14] || '').trim();
    var newMemo   = (oldMemo ? oldMemo + ' / ' : '') + 'DEP: ' + dep301;
    purSheet.getRange(purRowNum, 15).setValue(newMemo); // col15=備考
    SpreadsheetApp.flush();
    lines.push('[WRITE] 仕入れタブ row' + purRowNum + '(' + purId301 + ') 備考: "' + oldMemo + '" → "' + newMemo + '"');
  } else {
    lines.push('[INFO] 仕入れタブに row301 に対応する行が特定できませんでした（金額・odId="" で検索）');
    lines.push('       金額=' + amt301 + ' の odId空行を確認: ');
    var emptyOdAmt = purData301.filter(function(r) { return String(r[1]||'').trim() === '' && String(r[9]||'').trim() !== ''; });
    emptyOdAmt.forEach(function(r) {
      lines.push('       ' + r[0] + ' 金額=' + r[9] + ' 注文日=' + fmtD(r[3]));
    });
  }
  lines.push('');

  // row360 の確認（col87-100 が空なので仕入れタブにない見込み）
  lines.push('--- STEP 5: row360 の確認 ---');
  var ri360 = 299;
  var hasVal360 = false;
  for (var ci = 9; ci <= 22; ci++) {
    if (rC[ri360][ci] !== '' && rC[ri360][ci] !== null && rC[ri360][ci] !== undefined) {
      hasVal360 = true; break;
    }
  }
  lines.push('row360 col87-100有値: ' + hasVal360);
  lines.push(hasVal360 ? '→ 仕入れタブに存在する可能性あり（上記と同様に確認）' : '→ 仕入れタブに未取り込み（col87-100が全空）。DEP情報は移行対象外として記録のみ。');
  lines.push('  DEP情報: col101="' + String(rC[ri360][23]||'').trim() + '" DEP率=' + String(rC[ri360][29]||'').trim() + ' col105=' + fmtD(rC[ri360][27]));
  lines.push('');

  // ════════════════════════════════════════════
  // 最終状態: OM col31 有値行
  // ════════════════════════════════════════════
  lines.push('--- 最終: 予約販売一覧 ---');
  var omFinal = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 33).getValues() : [];
  var finalYoyaku = omFinal.filter(function(r) { return String(r[30] || '').trim() !== ''; }); // col31=idx30
  lines.push('予約販売件数: ' + finalYoyaku.length + '件');
  finalYoyaku.forEach(function(r) {
    lines.push('  ' + r[0] + ' 予約InvNo="' + r[30] + '" 発売予定=' + fmtD(r[31]) + ' DEP率=' + r[32]);
  });

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// 修正4 最終整理: OD-00053リセット + Japhunter再確認 + 未割当一覧
// ============================================================
function finalizeOrphanDep() {
  var ss      = getSpreadsheet();
  var lines   = ['=== 修正4 最終整理 ===', ''];

  var omSheet  = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var custSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  var omLast   = omSheet.getLastRow();

  // ── OM全読み込み（col1-33）──
  var omData = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 33).getValues() : [];
  var omRowByOdId = {};
  omData.forEach(function(row, idx) {
    var id = String(row[0] || '').trim();
    if (id) omRowByOdId[id] = idx + 2;
  });

  function fmtD(v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd');
    return (v === '' || v === null || v === undefined) ? '（空）' : String(v);
  }

  // ── [1] OD-00053 col31 リセット ──
  lines.push('--- [1] OD-00053 col31 リセット ---');
  var row53 = omRowByOdId['OD-00053'];
  if (row53) {
    var before53 = String(omSheet.getRange(row53, 31).getValue() || '').trim();
    omSheet.getRange(row53, 31).setValue('');
    SpreadsheetApp.flush();
    lines.push('[RESET] OD-00053 (OM row' + row53 + ') col31: "' + before53 + '" → ""');
  } else {
    lines.push('[ERROR] OD-00053 が OM に見つかりません');
  }
  lines.push('');

  // ── [2] Japhunter = CT-00026 かどうか + OMでの該当オーダー ──
  lines.push('--- [2] Japhunter / CT-00026 確認 ---');

  // 顧客マスタから CT-00026 を検索
  var custData = custSheet && custSheet.getLastRow() >= 2
    ? custSheet.getRange(2, 1, custSheet.getLastRow() - 1, 5).getValues()
    : [];
  var ct26Row = custData.find ? custData.find(function(r) { return String(r[0]||'').trim() === 'CT-00026'; }) : null;
  if (!ct26Row) {
    // fallback: linear search (GAS Rhino may lack Array.find)
    for (var ci = 0; ci < custData.length; ci++) {
      if (String(custData[ci][0]||'').trim() === 'CT-00026') { ct26Row = custData[ci]; break; }
    }
  }
  if (ct26Row) {
    lines.push('CT-00026 顧客マスタ: ' + JSON.stringify(ct26Row.slice(0, 5)));
  } else {
    lines.push('CT-00026: 顧客マスタに見つかりません');
  }

  // OMで col3(顧客ID)=CT-00026 の行を検索
  var ct26Orders = omData.filter(function(r) { return String(r[2]||'').trim() === 'CT-00026'; });
  lines.push('CT-00026 のOMオーダー: ' + ct26Orders.length + '件');
  ct26Orders.forEach(function(r) {
    lines.push('  ' + r[0] + ' 請求書番号=' + r[1] + ' ステータス=' + r[6]
      + ' 受注日=' + fmtD(r[7])
      + ' 請求書発行日=' + fmtD(r[16]));
  });
  lines.push('');

  // ── [3] 未割当DEP 最終一覧（記録のみ・書き込みなし）──
  lines.push('--- [3] 未割当DEP 最終一覧（記録のみ）---');
  var unmatched = [
    { sdRow: 82,  custName: 'LaffxyTCG',    depNo: '#DEP 0005',
      note: '候補3件（OD-00002/#0059, OD-00030/#0789, OD-00043/#0793）発売予定/DEP率で絞り込み不可' },
    { sdRow: 116, custName: 'Japhunter',     depNo: '#DEP 0006',
      note: '→ [2]の結果次第' },
    { sdRow: 360, custName: 'Cesar Avelino', depNo: '#DEP 0001',
      note: 'col87-100が全空・仕入れタブ未取り込み・移行対象外' }
  ];
  unmatched.forEach(function(u) {
    lines.push('row' + u.sdRow + ' ' + u.custName + ' ' + u.depNo);
    lines.push('  ' + u.note);
  });
  lines.push('');

  // ── [4] 予約販売 最終件数 ──
  lines.push('--- [4] 予約販売 最終一覧 ---');
  // OM col31 を再読込（リセット後）
  var omFinal = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 33).getValues() : [];
  var yoyaku = omFinal.filter(function(r) { return String(r[30]||'').trim() !== ''; });
  lines.push('予約販売件数: ' + yoyaku.length + '件');
  yoyaku.forEach(function(r) {
    lines.push('  ' + r[0] + ' 予約InvNo="' + r[30] + '" 発売予定=' + fmtD(r[31]) + ' DEP率=' + r[32]);
  });

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// src rows 自己帰属判定 + 予約列確定書き込み
// ============================================================
function srcRowsAnalysis() {
  var ss       = getSpreadsheet();
  var lines    = ['=== src rows 自己帰属判定 ===', ''];
  var DATA_START = 61, N_ROWS = 651;

  var omSheet   = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var custSheet = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
  var sdSheet   = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);

  // ── 売上データ読み込み ──
  var rA = sdSheet.getRange(DATA_START, 1,  N_ROWS, 12).getValues();
  var rC = sdSheet.getRange(DATA_START, 78, N_ROWS, 30).getValues();

  function fmtD(v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd');
    return (v === '' || v === null || v === undefined) ? '（空）' : String(v);
  }

  // ── 顧客マスタ: 名前 → CT-ID ──
  var custLast = custSheet ? custSheet.getLastRow() : 1;
  var custData = custLast >= 2 ? custSheet.getRange(2, 1, custLast - 1, 5).getValues() : [];
  var nameToCtId = {};
  custData.forEach(function(row) {
    var ctId = String(row[0] || '').trim();
    var name = String(row[2] || '').trim();
    if (ctId && name) nameToCtId[name] = ctId;
  });

  // ── OM全読み込み ──
  var omLast = omSheet.getLastRow();
  var omData = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 33).getValues() : [];
  var omRowByOdId = {};
  omData.forEach(function(row, idx) {
    var id = String(row[0] || '').trim();
    if (id) omRowByOdId[id] = idx + 2;
  });

  // ────────────────────────────────────────
  // 移行グループ化ロジックの再適用:
  //   非空invNo行 → baseInvNo でグループ化 → 該当OMオーダー
  //   空invNo行   → 顧客ID でグループ化 → 請求書番号空のOMオーダー
  // ────────────────────────────────────────

  // ── 空invNo行の src rows 再計算 ──
  // 顧客ID → 空invNoの売上データ行リスト
  var ctIdToEmptyInvRows = {};
  for (var ri = 0; ri < N_ROWS; ri++) {
    if (String(rA[ri][11] || '').trim()) continue; // 非空invNoはスキップ
    var custName = String(rA[ri][5] || '').trim();
    if (!custName) continue;
    var ctId = nameToCtId[custName] || '';
    if (!ctId) continue;
    if (!ctIdToEmptyInvRows[ctId]) ctIdToEmptyInvRows[ctId] = [];
    ctIdToEmptyInvRows[ctId].push({
      sdRow:   DATA_START + ri,
      ri:      ri,
      custName: custName,
      val101:  String(rC[ri][23] || '').trim(),
      amount:  String(rC[ri][14] || '').trim(),
      ordDate: fmtD(rC[ri][10]),
      release: fmtD(rC[ri][28]),
      depRate: String(rC[ri][29] || '').trim()
    });
  }

  // ── 非空invNo行の src rows ──
  // baseInv → 売上データ行リスト
  var baseInvToRows = {};
  for (var ri = 0; ri < N_ROWS; ri++) {
    var inv = String(rA[ri][11] || '').trim();
    if (!inv) continue;
    var base = inv.replace(/-\d+$/, '');
    if (!baseInvToRows[base]) baseInvToRows[base] = [];
    baseInvToRows[base].push(DATA_START + ri);
  }

  // ── [1] OD-00031 の src rows ──
  lines.push('--- [1] OD-00031 の src rows ---');
  var od31 = omData.filter(function(r) { return String(r[0]||'').trim() === 'OD-00031'; })[0];
  if (od31) {
    var ct31 = String(od31[2] || '').trim(); // CT-00026
    lines.push('OD-00031 顧客ID=' + ct31 + ' 請求書番号=' + (String(od31[1]||'').trim()||'（空）'));
    lines.push('グループ化キー: 顧客ID=' + ct31 + ' かつ invNo=空');
    var rows31 = ctIdToEmptyInvRows[ct31] || [];
    lines.push('src rows（空invNo + CT=' + ct31 + '）: ' + rows31.length + '行');
    rows31.forEach(function(r) {
      lines.push('  row' + r.sdRow + ' 取引先="' + r.custName + '"'
        + ' col101="' + r.val101 + '"'
        + ' 金額=' + r.amount
        + ' DEP率=' + r.depRate);
    });
    var has116 = rows31.some(function(r) { return r.sdRow === 116; });
    lines.push('row116 含まれるか: ' + (has116 ? '✔ YES → row116 は OD-00031 の自己帰属' : '✘ NO'));
  } else {
    lines.push('OD-00031: OMに見つかりません');
  }
  lines.push('');

  // ── [2] OD-00002 / OD-00030 / OD-00043 の src rows ──
  lines.push('--- [2] OD-00002 / OD-00030 / OD-00043 の src rows ---');
  var CHECK_ORDERS = [
    { odId: 'OD-00002', baseInv: '#0059' },
    { odId: 'OD-00030', baseInv: '#0789' },
    { odId: 'OD-00043', baseInv: '#0793' }
  ];
  CHECK_ORDERS.forEach(function(o) {
    var srcRows = baseInvToRows[o.baseInv] || [];
    var has82   = srcRows.indexOf(82) >= 0;
    lines.push(o.odId + '(' + o.baseInv + ') src rows: [' + srcRows.join(', ') + ']');
    lines.push('  row82 含まれるか: ' + (has82 ? '✔ YES' : '✘ NO → row82 はここに属さない'));
  });
  lines.push('');

  // ── [3] 自己帰属確定 + 書き込み ──
  lines.push('--- [3] 自己帰属確定 + 予約列書き込み ---');

  // LaffxyTCG の CT-ID を確認
  var laffxyCtId = nameToCtId['LaffxyTCG'] || '';
  lines.push('LaffxyTCG の CT-ID: ' + (laffxyCtId || '（顧客マスタにない）'));

  var WRITE_TARGETS = []; // {odId, sheetRow, val101, label}

  if (laffxyCtId) {
    // LaffxyTCGの空invNo行がどのOMオーダーに属するか
    var laffxyEmptyOrders = omData.filter(function(r) {
      return String(r[2]||'').trim() === laffxyCtId && !String(r[1]||'').trim();
    });
    lines.push('LaffxyTCG(' + laffxyCtId + ') + 請求書番号空のOMオーダー: ' + laffxyEmptyOrders.length + '件');
    laffxyEmptyOrders.forEach(function(r) {
      lines.push('  ' + r[0] + ' ステータス=' + r[6]);
    });

    var rows82Candidate = ctIdToEmptyInvRows[laffxyCtId] || [];
    var row82InSrc = rows82Candidate.some(function(r) { return r.sdRow === 82; });
    lines.push('row82 が LaffxyTCG 空invNoグループに含まれるか: ' + (row82InSrc ? '✔ YES' : '✘ NO'));

    if (row82InSrc && laffxyEmptyOrders.length === 1) {
      var tgt = laffxyEmptyOrders[0];
      WRITE_TARGETS.push({ odId: tgt[0], val101: '#DEP 0005', label: 'row82→' + tgt[0] });
    } else if (row82InSrc && laffxyEmptyOrders.length > 1) {
      lines.push('  → 複数オーダー一致・絞り込み不可（未割当のまま）');
    } else {
      lines.push('  → row82 は LaffxyTCG グループに含まれない（未割当）');
    }
  }
  lines.push('');

  // row116 / OD-00031 の書き込み判定
  var rows116Src = (od31 && ct31) ? (ctIdToEmptyInvRows[ct31] || []) : [];
  var has116confirmed = rows116Src.some(function(r) { return r.sdRow === 116; });
  if (has116confirmed) {
    WRITE_TARGETS.push({ odId: 'OD-00031', val101: '#DEP 0006', label: 'row116→OD-00031' });
  }

  lines.push('書き込み対象: ' + WRITE_TARGETS.length + '件');
  WRITE_TARGETS.forEach(function(t) {
    var sheetRow = omRowByOdId[t.odId];
    if (!sheetRow) { lines.push('[ERROR] ' + t.odId + ' OM行なし'); return; }
    var before = String(omSheet.getRange(sheetRow, 31).getValue() || '').trim();
    if (before) {
      lines.push('[SKIP] ' + t.label + ' col31="' + before + '" 既存値あり');
    } else {
      omSheet.getRange(sheetRow, 31).setValue(t.val101);
      lines.push('[WRITE] ' + t.label + ' col31 → "' + t.val101 + '"');
    }
  });
  SpreadsheetApp.flush();
  lines.push('');

  // ── [4] 最終: 予約販売件数 ──
  lines.push('--- [4] 予約販売 最終一覧 ---');
  var omFinal = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 33).getValues() : [];
  var yoyaku  = omFinal.filter(function(r) { return String(r[30] || '').trim() !== ''; });
  lines.push('予約販売件数: ' + yoyaku.length + '件');
  yoyaku.forEach(function(r) {
    lines.push('  ' + r[0] + ' 予約InvNo="' + r[30] + '" 発売予定=' + fmtD(r[31]) + ' DEP率=' + r[32]);
  });
  lines.push('');

  // ── 未割当DEP 最終確定 ──
  lines.push('--- 未割当DEP 最終確定 ---');
  var unmatched = [
    { sdRow: 82,  custName: 'LaffxyTCG',    depNo: '#DEP 0005' },
    { sdRow: 360, custName: 'Cesar Avelino', depNo: '#DEP 0001' }
  ];
  // row116 は書き込み成功したら除外
  var wrote116 = WRITE_TARGETS.some(function(t) { return t.label.indexOf('row116') >= 0; });
  if (!wrote116) {
    unmatched.push({ sdRow: 116, custName: 'Japhunter', depNo: '#DEP 0006' });
  }
  // row82 が書き込まれていれば除外
  var wrote82 = WRITE_TARGETS.some(function(t) { return t.label.indexOf('row82') >= 0; });
  if (wrote82) {
    unmatched = unmatched.filter(function(u) { return u.sdRow !== 82; });
  }
  lines.push('未割当: ' + unmatched.length + '件');
  unmatched.forEach(function(u) {
    lines.push('  row' + u.sdRow + ' ' + u.custName + ' ' + u.depNo + ' → OM紐付け不可・記録のみ');
  });

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// 修正4 突合妥当性確認（読み取りのみ）
// ============================================================
function auditOrphanDep() {
  var ss        = getSpreadsheet();
  var lines     = ['=== 修正4 突合妥当性確認 ===', ''];
  var DATA_START = 61;
  var sdSheet   = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);

  // ── ヘッダー行確認（col1-12）──
  var headerRow = sdSheet.getRange(DATA_START - 1, 1, 1, 12).getValues()[0];
  lines.push('--- 売上データ col1-12 ヘッダー ---');
  headerRow.forEach(function(h, i) {
    if (h) lines.push('  col' + (i + 1) + ': ' + h);
  });
  lines.push('');

  // ── 売上データ読み込み ──
  var rA = sdSheet.getRange(DATA_START, 1,  651, 12).getValues(); // col1-12
  var rC = sdSheet.getRange(DATA_START, 78, 651, 30).getValues(); // col78-107

  function fmtD(v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd');
    return (v === '' || v === null || v === undefined) ? '（空）' : String(v);
  }

  // ── 5件の比較 ──
  var CASES = [
    { ri: 21,  sdRow: 82,  odId: 'OD-00014', baseInv: '#0806', adjRi: 20,  adjRow: 81  },
    { ri: 55,  sdRow: 116, odId: 'OD-00030', baseInv: '#0789', adjRi: 54,  adjRow: 115 },
    { ri: 130, sdRow: 191, odId: 'OD-00053', baseInv: '#0808', adjRi: 129, adjRow: 190 },
    { ri: 240, sdRow: 301, odId: 'OD-00094', baseInv: '#0847', adjRi: 239, adjRow: 300 },
    { ri: 299, sdRow: 360, odId: 'OD-00108', baseInv: '#0862', adjRi: 298, adjRow: 359 }
  ];

  CASES.forEach(function(c) {
    var oCust  = String(rA[c.ri][5]    || '').trim(); // col6 取引先名
    var aCust  = String(rA[c.adjRi][5] || '').trim();
    var oInv   = String(rA[c.ri][11]   || '').trim(); // col12 invNo
    var aInv   = String(rA[c.adjRi][11]|| '').trim();

    var oVal101   = String(rC[c.ri][23]    || '').trim(); // col101
    var oAmount   = String(rC[c.ri][14]    || '').trim(); // col92
    var aAmount   = String(rC[c.adjRi][14] || '').trim();
    var oOrdDate  = fmtD(rC[c.ri][10]);                   // col88 注文日
    var aOrdDate  = fmtD(rC[c.adjRi][10]);
    var oCol105   = fmtD(rC[c.ri][27]);                   // col105
    var oRelease  = fmtD(rC[c.ri][28]);                   // col106 発売予定日
    var aRelease  = fmtD(rC[c.adjRi][28]);
    var oDepRate  = String(rC[c.ri][29]    || '').trim(); // col107

    var custMatch = (oCust !== '' && oCust === aCust);
    var judgment  = custMatch
      ? '✔ 取引先名一致 → 紐付け維持'
      : (oCust === '' ? '△ orphan側col6が空（確認不可）' : '✘ 不一致 → 予約列を空に戻すべき');

    lines.push('═══ row' + c.sdRow + ' → ' + c.odId + '(' + c.baseInv + ') ═══');
    lines.push('取引先名:      orphan(row' + c.sdRow + ')="' + oCust + '"  adjacent(row' + c.adjRow + ')="' + aCust + '"');
    lines.push('               → ' + judgment);
    lines.push('invNo:         orphan="' + oInv + '"  adjacent="' + aInv + '"');
    lines.push('col101:        "' + oVal101 + '"');
    lines.push('金額(col92):   orphan=' + oAmount + '  adjacent=' + aAmount);
    lines.push('注文日(col88): orphan=' + oOrdDate + '  adjacent=' + aOrdDate);
    lines.push('col105:        orphan=' + oCol105);
    lines.push('発売予定(106): orphan=' + oRelease + '  adjacent=' + aRelease);
    lines.push('デポジット率:  orphan=' + oDepRate);
    lines.push('');
  });

  // ── OM側データ（突合先オーダー）──
  var omSheet    = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var omLast     = omSheet.getLastRow();
  var omData     = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 26).getValues() : [];
  var TARGET_ODS = ['OD-00014','OD-00030','OD-00053','OD-00094','OD-00108'];
  var omByOdId   = {};
  omData.forEach(function(row) {
    var id = String(row[0] || '').trim();
    if (TARGET_ODS.indexOf(id) >= 0) omByOdId[id] = row;
  });

  lines.push('--- OM側データ（突合先オーダー）---');
  TARGET_ODS.forEach(function(id) {
    var r = omByOdId[id];
    if (!r) { lines.push(id + ': OMデータなし'); return; }
    lines.push(id
      + ' invNo='       + String(r[1] || '')
      + ' 顧客ID='      + String(r[2] || '')
      + ' ステータス='  + String(r[6] || '')
      + ' 受注日='      + fmtD(r[7])
      + ' 請求書発行日=' + fmtD(r[16])
      + ' 支払確認日='  + fmtD(r[18]));
  });
  lines.push('');

  // ── #DEP 0001 重複: row301 vs row360 ──
  lines.push('--- #DEP 0001 重複確認: row301 vs row360 ---');
  var ri301 = 240, ri360 = 299;

  var FIELDS = [
    { label: '取引先名(col6)',    v301: String(rA[ri301][5]  ||'').trim(), v360: String(rA[ri360][5]  ||'').trim() },
    { label: 'invNo(col12)',      v301: String(rA[ri301][11] ||'').trim(), v360: String(rA[ri360][11] ||'').trim() },
    { label: '金額(col92)',       v301: String(rC[ri301][14] ||'').trim(), v360: String(rC[ri360][14] ||'').trim() },
    { label: '注文日(col88)',     v301: fmtD(rC[ri301][10]),               v360: fmtD(rC[ri360][10])               },
    { label: 'col105',            v301: fmtD(rC[ri301][27]),               v360: fmtD(rC[ri360][27])               },
    { label: '発売予定(col106)',  v301: fmtD(rC[ri301][28]),               v360: fmtD(rC[ri360][28])               },
    { label: 'デポジット率(107)', v301: String(rC[ri301][29] ||'').trim(), v360: String(rC[ri360][29] ||'').trim() },
    { label: '仕入元(col91)',     v301: String(rC[ri301][13] ||'').trim(), v360: String(rC[ri360][13] ||'').trim() }
  ];

  FIELDS.forEach(function(f) {
    var same = (f.v301 === f.v360);
    lines.push(f.label + ':');
    lines.push('  row301: "' + f.v301 + '"');
    lines.push('  row360: "' + f.v360 + '"');
    lines.push('  → ' + (same ? '同一' : (f.v301 === '' || f.v360 === '' ? '片方空' : '異なる')));
  });
  lines.push('');
  lines.push('隣接行:');
  lines.push('  row300(ri=239) invNo="' + String(rA[239][11]||'') + '" 取引先="' + String(rA[239][5]||'') + '"');
  lines.push('  row359(ri=298) invNo="' + String(rA[298][11]||'') + '" 取引先="' + String(rA[298][5]||'') + '"');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}
