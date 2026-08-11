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
