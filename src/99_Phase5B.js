// ============================================================
// 是正: オーダー管理 進捗6列削除（SSOT違反解消）
// Phase5-B: 発送・仕入れ・オーダー追加列 DRY_RUN
// ============================================================

// ── 担当者変換表（Phase5-B全体で共有）──
var STAFF_CONVERT = {
  '谷澤':      'EMP-00001',
  '谷澤 伸吾': 'EMP-00001',
  '阿部':      'EMP-00007',
  '森本':      'EMP-00004',
  '営業 太郎': 'EMP-00002'
};

function toEmpId(name) {
  var n = String(name || '').trim();
  return STAFF_CONVERT[n] || '';
}

function toFlag(v) {
  var s = String(v || '').trim();
  return (s === '✔︎' || s === '完了');
}

function cleanTracking(trk) {
  // ゼロ幅文字（U+200B-U+200F, U+FEFF, U+202A-U+202E）除去 + 前後空白
  return String(trk || '').replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, '').trim();
}

function isValidTracking(trk) {
  var s = cleanTracking(trk);
  if (s.length < 5) return false;
  if (/^-+$/.test(s)) return false; // "-" のみは無効
  return /^[0-9A-Za-z\-]{5,}$/.test(s);
}

// ============================================================
// 是正: removeOrderProgressColumns — 進捗6列(col30〜35)を削除
// ============================================================
function removeOrderProgressColumns() {
  var ss = getSpreadsheet();
  var lines = ['=== 是正: オーダー管理 進捗6列削除 ===', ''];

  var sheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  if (!sheet) {
    lines.push('[ERROR] ' + CONFIG.SHEETS.ORDER_MASTER + ' が見つかりません');
    Logger.log(lines.join('\n'));
    return lines.join('\n');
  }

  var currentCols = sheet.getLastColumn();
  var lastRow     = sheet.getLastRow();
  lines.push('削除前: 列数=' + currentCols + ' / データ行数=' + (lastRow - 1));

  // ── スナップショット（削除前）OD-00001/00086/00172 の col1〜26 ──
  var targetIds = ['OD-00001', 'OD-00086', 'OD-00172'];
  var beforeAll = sheet.getRange(2, 1, lastRow - 1, 26).getValues();
  var snapBefore = {};
  beforeAll.forEach(function(row, idx) {
    var id = String(row[0] || '').trim();
    if (targetIds.indexOf(id) >= 0) snapBefore[id] = row.slice();
  });

  // ── col30〜35 (1-indexed) を6列削除 ──
  // deleteColumns(startCol_1indexed, numCols)
  sheet.deleteColumns(30, 6);
  SpreadsheetApp.flush();

  lines.push('[WRITE] col30〜35 削除完了（検品/梱包/格納/集荷依頼/通知/ラベル発行）');
  lines.push('削除後: 列数=' + sheet.getLastColumn());
  lines.push('');

  // ── 列一覧（全33列）──
  lines.push('--- 列一覧（全' + HEADERS.ORDER_MASTER.length + '列）---');
  HEADERS.ORDER_MASTER.forEach(function(h, i) {
    lines.push('  col' + (i + 1) + ' ' + h);
  });
  lines.push('');

  // ── compareOrderHeaders ──
  lines.push(compareOrderHeaders());
  lines.push('');

  // ── スナップショット比較（削除後 col1〜26）──
  var afterAll = sheet.getRange(2, 1, lastRow - 1, 26).getValues();
  var snapAfter = {};
  afterAll.forEach(function(row) {
    var id = String(row[0] || '').trim();
    if (targetIds.indexOf(id) >= 0) snapAfter[id] = row.slice();
  });

  lines.push('--- 既存データ前後比較（col1〜26）---');
  var totalMM = 0;
  function toStr(v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd');
    return String(v === null || v === undefined ? '' : v);
  }
  targetIds.forEach(function(id) {
    var before = snapBefore[id], after = snapAfter[id];
    if (!before || !after) { lines.push(id + ': データなし'); return; }
    var mm = [];
    for (var i = 0; i < 26; i++) {
      if (toStr(before[i]) !== toStr(after[i]))
        mm.push('col' + (i + 1) + ': "' + toStr(before[i]) + '" → "' + toStr(after[i]) + '"');
    }
    totalMM += mm.length;
    lines.push(id + ': mismatches=' + mm.length + (mm.length === 0 ? ' [OK]' : ' [FAIL]'));
    mm.forEach(function(m) { lines.push('  ' + m); });
  });
  lines.push('合計 mismatches=' + totalMM + ' [' + (totalMM === 0 ? 'OK' : 'FAIL') + ']');
  lines.push('');
  lines.push('=== 是正完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}

// ============================================================
// Phase5-B: DRY_RUN
// ============================================================
function dryRunPhase5B() {
  var ss = getSpreadsheet();
  var lines = ['=== Phase5-B DRY_RUN（書き込みなし）===', ''];

  // ── 売上データ読み込み ──
  var sdSheet = ss.getSheetByName(CONFIG.SHEETS.SALES_DATA);
  if (!sdSheet) { lines.push('[ERROR] SALES_DATA not found'); Logger.log(lines.join('\n')); return lines.join('\n'); }
  var DATA_START = 61, N_ROWS = 651;

  // rA: col1-12   invNo(idx11), 受注担当(idx3), 営業担当(idx4)
  var rA = sdSheet.getRange(DATA_START, 1,   N_ROWS, 12).getValues();
  // rB: col40-56  発送担当(idx0), 検品(idx1), 長さ(idx3), 幅(idx4), 高さ(idx5),
  //               重量(idx7), 梱包(idx9), ラベル(idx16)
  var rB = sdSheet.getRange(DATA_START, 40,  N_ROWS, 17).getValues();
  // rC: col78-107 発送方法(idx0), 発送日(idx1), 運送状番号(idx2), 見積もり送料(idx3),
  //               格納(idx4), 集荷依頼(idx5), ?(idx6), 通知(idx7), 発送時メモ(idx8),
  //               仕入担当(idx9), 注文日(idx10), 取引番号(idx11),
  //               ?(idx12)=col90, 仕入元(idx13)=col91, 金額(idx14)=col92,
  //               数量(idx15)=col93, 総額(idx16)=col94, 送料代行(idx17)=col95,
  //               仕入元URL(idx18)=col96, 運送会社(idx19)=col97, 送り状番号(idx20)=col98,
  //               備考(idx21)=col99, ステータス(idx22)=col100,
  //               予約請求書番号(idx23)=col101, ?(idx24-28), 発売予定日(idx28)=col106,
  //               デポジット率(idx29)=col107
  var rC = sdSheet.getRange(DATA_START, 78,  N_ROWS, 30).getValues();
  var rCF = sdSheet.getRange(DATA_START, 92,  N_ROWS,  3).getFormulas(); // col92-94のみ数式チェック
  // rD: col152   取引備考欄(idx0)
  var rD = sdSheet.getRange(DATA_START, 152, N_ROWS, 1).getValues();

  // ── オーダー管理読み込み（baseInvNo → {odId, rowIdx}）──
  var omSheet = ss.getSheetByName(CONFIG.SHEETS.ORDER_MASTER);
  var omLast  = omSheet.getLastRow();
  var omData  = omLast >= 2 ? omSheet.getRange(2, 1, omLast - 1, 2).getValues() : [];
  var omMap   = {}; // baseInvNo → odId
  omData.forEach(function(r) {
    var odId = String(r[0] || '').trim();
    var inv  = String(r[1] || '').trim();
    if (inv) omMap[inv.replace(/-\d+$/, '')] = odId;
  });
  lines.push('OM登録済みオーダー数: ' + Object.keys(omMap).length);
  lines.push('');

  // ── rC カラムオフセット確認（col78基準）──
  // col78=idx0, col79=idx1, col80=idx2, col81=idx3,
  // col82=idx4, col83=idx5, col84=idx6, col85=idx7, col86=idx8,
  // col87=idx9, col88=idx10, col89=idx11, col90=idx12, col91=idx13,
  // col92=idx14, col93=idx15, col94=idx16, col95=idx17, col96=idx18,
  // col97=idx19, col98=idx20, col99=idx21, col100=idx22,
  // col101=idx23, col102=idx24, col103=idx25, col104=idx26, col105=idx27,
  // col106=idx28, col107=idx29

  // ── rB カラムオフセット確認（col40基準）──
  // col40=idx0, col41=idx1, col42=idx2, col43=idx3, col44=idx4,
  // col45=idx5, col46=idx6, col47=idx7, col48=idx8, col49=idx9,
  // col50-55=idx10-15, col56=idx16

  // ── 担当者変換 カウンタ ──
  var empConvCounts = {};
  var empConvFail   = [];
  function convertEmp(name, ctx) {
    var n = String(name || '').trim();
    if (!n) return '';
    var id = STAFF_CONVERT[n] || '';
    if (id) {
      empConvCounts[n] = (empConvCounts[n] || 0) + 1;
    } else {
      empConvFail.push(ctx + ': "' + n + '"');
    }
    return id;
  }

  // ── 発送タブ 生成 ──
  // Group by baseInvNo → tracking → first-row-data
  var shipGroups = {}; // baseInv → {tracking_or_EMPTY → {rowData, isInvalid, origTrk}}
  var noTrackingOrders = {}; // baseInv → true (全行tracking空)
  var anomalies = [];

  for (var ri = 0; ri < N_ROWS; ri++) {
    var invNo    = String(rA[ri][11] || '').trim();
    var baseInv  = invNo.replace(/-\d+$/, '');
    if (!baseInv) continue;

    var odId = omMap[baseInv];
    if (!odId) continue; // 移行済みオーダー以外はスキップ

    var rawTrk  = String(rC[ri][2] || ''); // col80 生値
    var trk     = cleanTracking(rawTrk);   // ゼロ幅除去・trim済み

    if (!shipGroups[baseInv]) shipGroups[baseInv] = {};

    if (!trk) {
      // tracking空: 未発送候補として記録するだけ
      if (!shipGroups[baseInv]['__EMPTY__']) {
        shipGroups[baseInv]['__EMPTY__'] = { rowIdx: ri, isInvalid: false, cleanTrk: '', origTrk: '' };
      }
      continue;
    }

    var valid  = isValidTracking(trk); // cleanTracking済みの値で判定
    var mapKey = valid ? trk : '__INVALID_' + ri + '__';

    if (valid && shipGroups[baseInv][trk]) {
      // 既出の有効tracking → スキップ（同一ORDERの同一tracking）
      continue;
    }

    shipGroups[baseInv][mapKey] = {
      rowIdx:    ri,
      isInvalid: !valid,
      cleanTrk:  trk,    // クリーン済み（保存値として使う）
      origTrk:   rawTrk  // 生値（備考転記・デバッグ用）
    };

    if (!valid) {
      anomalies.push('発送: baseInv=' + baseInv + ' odId=' + odId + ' 無効運送状="' + trk + '"（生="' + rawTrk.replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, '[ZW]') + '"）→ 運送状空欄・備考に転記');
    }
  }

  // 発送行を構築
  var shipRows   = [];
  var shipExamples = []; // 個口分割実例（baseInv → 行リスト）
  var nextShipNum  = 1; // SHP-XXXXX (DRY_RUN用のカウンタ)

  Object.keys(shipGroups).sort().forEach(function(baseInv) {
    var odId   = omMap[baseInv];
    var group  = shipGroups[baseInv];
    var keys   = Object.keys(group).filter(function(k) { return k !== '__EMPTY__'; });

    if (keys.length === 0) {
      // 有効tracking ゼロ → 未発送 (発送行なし)
      return;
    }

    var boxNum = 1;
    var exRows = [];
    keys.forEach(function(k) {
      var entry  = group[k];
      var ri     = entry.rowIdx;
      var trk    = entry.isInvalid ? '' : entry.cleanTrk; // クリーン済みを保存
      var memo   = String(rC[ri][8] || '').trim(); // col86
      if (entry.isInvalid && entry.cleanTrk) {
        // 無効運送状は備考に原文（生値）を転記
        var rawDisp = entry.origTrk.replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, '');
        memo = (memo ? memo + ' / ' : '') + '運送状原文: ' + rawDisp;
      }

      var staffName = String(rB[ri][0] || '').trim(); // col40
      var empId     = convertEmp(staffName, '発送 ' + baseInv);

      var shipRow = {
        shpId:      'SHP-' + ('00000' + nextShipNum++).slice(-5),
        odId:       odId,
        boxNum:     boxNum++,
        method:     String(rC[ri][0] || '').trim(),  // col78
        date:       rC[ri][1],                         // col79
        tracking:   trk,
        len:        String(rB[ri][3] || '').trim(),   // col43
        wid:        String(rB[ri][4] || '').trim(),   // col44
        hei:        String(rB[ri][5] || '').trim(),   // col45
        weight:     String(rB[ri][7] || '').trim(),   // col47
        estFee:     String(rC[ri][3] || '').trim(),   // col81
        kenshin:    toFlag(rB[ri][1]),                // col41
        konpo:      toFlag(rB[ri][9]),                // col49
        kino:       toFlag(rC[ri][4]),                // col82
        shuukai:    toFlag(rC[ri][5]),                // col83
        tsuchi:     toFlag(rC[ri][7]),                // col85
        label:      false,                             // col56 全てFALSE
        empId:      empId,
        memo:       memo
      };
      shipRows.push(shipRow);
      exRows.push(shipRow);
    });

    if (exRows.length > 1 || baseInv === 'P0019') {
      shipExamples.push({ baseInv: baseInv, odId: odId, rows: exRows });
    }
  });

  // ── 仕入れタブ 生成 ──
  // 救済された運送状（数字以外だが有効判定）カウンタ
  var rescuedTracking = [];
  Object.keys(shipGroups).forEach(function(baseInv) {
    var group = shipGroups[baseInv];
    Object.keys(group).forEach(function(k) {
      var e = group[k];
      if (!e.isInvalid && e.cleanTrk && !/^\d+$/.test(e.cleanTrk)) {
        rescuedTracking.push({ baseInv: baseInv, trk: e.cleanTrk, orig: e.origTrk });
      }
    });
  });

  var purRows    = [];
  var nextPurNum = 1;
  var purFormulas = [];
  var purSumSkipped = [];

  for (var ri = 0; ri < N_ROWS; ri++) {
    // col87-100 のいずれかに値があるか
    var hasVal = false;
    for (var ci = 9; ci <= 22; ci++) { // rC idx9-22 = col87-100
      if (rC[ri][ci] !== '' && rC[ri][ci] !== null && rC[ri][ci] !== undefined) {
        hasVal = true; break;
      }
    }
    if (!hasVal) continue;

    var invNo    = String(rA[ri][11] || '').trim();
    var baseInv  = invNo.replace(/-\d+$/, '');
    var odId     = baseInv ? (omMap[baseInv] || '') : '';
    if (!odId && baseInv) {
      anomalies.push('仕入れ: row' + (DATA_START + ri) + ' baseInv=' + baseInv + ' → OMにオーダーなし（純粋仕入れ候補）');
    }

    // row324 数式チェック (ri = 324-61=263)
    var sdRow = DATA_START + ri;
    var kinFm = String(rCF[ri][0] || ''); // col92の数式
    var kinVal = rC[ri][14];              // col92の値
    if (kinFm) {
      if (kinFm.indexOf('SUM') >= 0) {
        // 修正2: SUM集計行は仕入れ行から除外（個別行との二重計上防止）
        purSumSkipped.push('row' + sdRow + ' 除外: ' + kinFm + ' → 表示値=' + kinVal);
        continue;
      }
      purFormulas.push('row' + sdRow + ' col92数式: ' + kinFm + ' → 表示値=' + kinVal);
    }

    var staffName = String(rC[ri][9] || '').trim(); // col87
    var empId     = convertEmp(staffName, '仕入れ row' + sdRow);

    purRows.push({
      purId:    'PUR-' + ('00000' + nextPurNum++).slice(-5),
      odId:     odId,
      empId:    empId,
      orderDate: rC[ri][10],                           // col88
      txNo:     String(rC[ri][11] || '').trim(),       // col89
      vendor:   String(rC[ri][13] || '').trim(),       // col91
      vendorUrl:String(rC[ri][18] || '').trim(),       // col96
      qty:      String(rC[ri][15] || '').trim(),       // col93
      amount:   String(kinFm ? kinVal : rC[ri][14] || ''), // col92(値)
      delivery: String(rC[ri][17] || '').trim(),       // col95
      carrier:  String(rC[ri][19] || '').trim(),       // col97
      trackId:  String(rC[ri][20] || '').trim(),       // col98
      status:   String(rC[ri][22] || '').trim(),       // col100
      memo:     String(rC[ri][21] || '').trim(),       // col99
      isFormula: !!kinFm,
      sdRow:    sdRow
    });
  }

  // ── 修正3: col101(予約請求書番号) 全行収集 ──
  var col101Rows = []; // { sdRow, invNo, baseInv, odId, val }
  for (var ri = 0; ri < N_ROWS; ri++) {
    var val101 = String(rC[ri][23] || '').trim(); // col101 = rC idx23
    if (!val101) continue;
    var inv101  = String(rA[ri][11] || '').trim();
    var base101 = inv101.replace(/-\d+$/, '');
    col101Rows.push({
      sdRow:   DATA_START + ri,
      invNo:   inv101,
      baseInv: base101,
      odId:    base101 ? (omMap[base101] || '（OM未登録）') : '（invNo空）',
      val:     val101
    });
  }

  // ── OM追加列 更新 ──
  var omUpdates  = [];
  var processedBase = {};
  for (var ri = 0; ri < N_ROWS; ri++) {
    var invNo   = String(rA[ri][11] || '').trim();
    var baseInv = invNo.replace(/-\d+$/, '');
    if (!baseInv || processedBase[baseInv]) continue;
    var odId = omMap[baseInv];
    if (!odId) continue;

    processedBase[baseInv] = true;

    omUpdates.push({
      odId:    odId,
      baseInv: baseInv,
      juchuEmp: convertEmp(String(rA[ri][3] || '').trim(), 'OM受注 ' + baseInv),
      eigyoEmp: convertEmp(String(rA[ri][4] || '').trim(), 'OM営業 ' + baseInv),
      hassouEmp: convertEmp(String(rB[ri][0] || '').trim(), 'OM発送 ' + baseInv),
      bizMemo:  String(rD[ri][0] || '').trim(),        // col152
      yoyakuInv: String(rC[ri][23] || '').trim(),      // col101
      releaseDate: rC[ri][28],                          // col106
      depositRate: String(rC[ri][29] || '').trim()     // col107
    });
  }

  // ── 予約販売行（yoyakuInvに値あり）──
  var yoyakuList = omUpdates.filter(function(u) { return u.yoyakuInv !== ''; });

  // ============================================================
  // 出力
  // ============================================================

  // 1. 生成行数
  lines.push('--- 1. 生成行数 ---');
  lines.push('発送行数:               ' + shipRows.length);
  lines.push('  うち救済（非数字）:   ' + rescuedTracking.length);
  lines.push('発送0件オーダー:        ' + (function() {
    var cnt = 0;
    Object.keys(shipGroups).forEach(function(bi) {
      var g = shipGroups[bi];
      var hasValid = Object.keys(g).some(function(k) { return k !== '__EMPTY__' && !g[k].isInvalid; });
      if (!hasValid) cnt++;
    });
    return cnt;
  })() + '件（本当に未発送）');
  lines.push('仕入れ行数:             ' + purRows.length);
  lines.push('  うち数式混入行:       ' + purFormulas.length);
  lines.push('  SUM除外行:            ' + purSumSkipped.length);
  lines.push('更新するオーダー数:     ' + omUpdates.length);
  lines.push('  うち予約販売:         ' + yoyakuList.length);
  lines.push('');

  // 1-A. 救済された運送状
  lines.push('--- 1-A. 救済された非数字運送状（修正1）---');
  lines.push('件数: ' + rescuedTracking.length);
  rescuedTracking.forEach(function(r) {
    lines.push('  baseInv=' + r.baseInv + ' cleanTrk="' + r.trk + '"' + (r.orig !== r.trk ? ' ← 生値に隠れ文字あり' : ''));
  });
  lines.push('');

  // 1-B. SUM除外行
  lines.push('--- 1-B. SUM除外した仕入れ行（修正2）---');
  purSumSkipped.forEach(function(s) { lines.push('  ' + s); });
  if (purSumSkipped.length === 0) lines.push('  なし');
  // row325〜338 の個別金額有無を確認
  // DATA_START=61, row325=ri264, row338=ri277
  lines.push('  [確認] row325〜338 (ri=264〜277) の col92個別値:');
  var row325to338 = [];
  for (var ci2 = 264; ci2 <= 277; ci2++) {
    var v = rC[ci2] ? rC[ci2][14] : null; // col92=idx14
    if (v !== '' && v !== null && v !== undefined) {
      row325to338.push('    row' + (DATA_START + ci2) + '(ri=' + ci2 + '): col92=' + v);
    }
  }
  if (row325to338.length > 0) {
    lines.push('  → 個別値あり（' + row325to338.length + '行）。SUM除外は正当。');
    row325to338.forEach(function(l) { lines.push(l); });
  } else {
    lines.push('  → 個別値なし。SUM行が唯一の金額源。要確認 [!]');
  }
  lines.push('');

  // 2. 発送個口分割実例5件（P0019必須含む）
  lines.push('--- 2. 発送個口分割 実例5件 ---');
  // Sort: P0019 first, then by count desc
  shipExamples.sort(function(a, b) {
    if (a.baseInv === 'P0019') return -1;
    if (b.baseInv === 'P0019') return 1;
    return b.rows.length - a.rows.length;
  });
  var exCount = 0;
  shipExamples.forEach(function(ex) {
    if (exCount >= 5) return;
    exCount++;
    lines.push('【' + ex.baseInv + ' / ' + ex.odId + ' : ' + ex.rows.length + '個口】');
    ex.rows.forEach(function(r) {
      lines.push('  箱' + r.boxNum + ' ' + r.shpId
        + ' tracking=' + (r.tracking || '（空）')
        + ' 発送方法=' + r.method
        + ' 発送日=' + (r.date instanceof Date ? Utilities.formatDate(r.date, 'Asia/Tokyo', 'yyyy/MM/dd') : r.date)
        + ' 寸法=' + r.len + 'x' + r.wid + 'x' + r.hei + ' ' + r.weight + 'kg'
        + ' 担当=' + r.empId
        + ' 検品=' + r.kenshin + ' 梱包=' + r.konpo + ' 格納=' + r.kino
        + ' 集荷=' + r.shuukai + ' 通知=' + r.tsuchi
        + (r.memo ? ' 備考="' + r.memo + '"' : ''));
    });
  });
  lines.push('');

  // 3. 担当者変換結果
  lines.push('--- 3. 担当者変換結果 ---');
  Object.keys(empConvCounts).sort().forEach(function(name) {
    lines.push('  "' + name + '" → ' + STAFF_CONVERT[name] + ': ' + empConvCounts[name] + '件');
  });
  lines.push('変換不可: ' + empConvFail.length + '件');
  if (empConvFail.length > 0) empConvFail.forEach(function(l) { lines.push('  ' + l); });
  lines.push('');

  // 4. 異常一覧（全件）
  lines.push('--- 4. 異常一覧 ---');
  lines.push('件数: ' + anomalies.length);
  anomalies.forEach(function(a) { lines.push('  ' + a); });
  if (purFormulas.length > 0) {
    lines.push('数式混入詳細:');
    purFormulas.forEach(function(f) { lines.push('  ' + f); });
  }
  lines.push('');

  // 5. 予約販売一覧（修正3: col101全行 + 収束確認）
  lines.push('--- 5-A. col101(予約請求書番号) 全行一覧（修正3）---');
  lines.push('col101に値がある行: ' + col101Rows.length + '行');
  // 重複baseInvをカウント（何オーダーに収束するか）
  var col101BaseSet = {};
  col101Rows.forEach(function(r) {
    if (r.baseInv) col101BaseSet[r.baseInv] = true;
  });
  lines.push('収束オーダー数: ' + Object.keys(col101BaseSet).length + '件');
  col101Rows.forEach(function(r) {
    var flag = (r.val === '全額前払い') ? ' ★全額前払い' : '';
    lines.push('  row' + r.sdRow + ' invNo=' + r.invNo
      + ' → ' + r.odId
      + ' col101="' + r.val + '"' + flag);
  });
  lines.push('');
  lines.push('--- 5-B. 予約販売一覧（omUpdatesから・' + yoyakuList.length + '件）---');
  yoyakuList.forEach(function(u) {
    var rel = u.releaseDate instanceof Date
      ? Utilities.formatDate(u.releaseDate, 'Asia/Tokyo', 'yyyy/MM/dd')
      : String(u.releaseDate || '');
    var flag = (u.yoyakuInv === '全額前払い') ? ' ★全額前払い（番号でなくテキスト）' : '';
    lines.push('  ' + u.odId + ' baseInv=' + u.baseInv
      + ' 予約InvNo="' + u.yoyakuInv + '"' + flag
      + ' 発売予定=' + rel
      + ' デポジット率=' + u.depositRate);
  });
  lines.push('');
  lines.push('=== DRY_RUN完了 ===');

  var result = lines.join('\n');
  Logger.log(result);
  return result;
}
