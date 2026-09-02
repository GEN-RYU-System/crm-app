/**
 * DEV専用: PostgreSQL 移植に向けた構造分析（段階1）
 *
 * 調査対象: sql-migration-scope.md に記載の22シート
 * 読み取り専用: setValue / setValues / appendRow / insertSheet 等の書き込み系操作は一切行わない。
 *
 * 使い方:
 *   clasp run devPostgresMigrationAnalysisStage1
 *
 * 戻り値: JSON文字列（全シート分析・FK検証・重複検出・PG固有チェック）
 *
 * GAS実行時間制限（6分）に備え、分析は3分割関数でも対応:
 *   devPostgresMigrationAnalysisSheets1to8()   — シート1〜8
 *   devPostgresMigrationAnalysisSheets9to16()  — シート9〜16
 *   devPostgresMigrationAnalysisSheets17to22() — シート17〜22 + FK + 重複 + PG固有
 */

// PII 列名パターン（これらの列の実サンプル値は記録しない）
var PMA_PII_PATTERNS = [
  '顧客名', 'customer_name', 'name', 'full_name', '会社名', 'company_name',
  'メール', 'email', '電話番号', 'phone', '連絡先', 'contact',
  '住所', 'address', 'address_line', 'recipient_name', 'billing_name',
  'display_name', 'last_name', 'first_name',
  '呼び方', 'english_call_name', 'payee_name', 'payment_email',
  'contact_name'
];

// PostgreSQL 16 予約語リスト（小文字）
var PMA_PG_RESERVED_WORDS = [
  'all','analyse','analyze','and','any','as','asc','authorization',
  'between','bigint','binary','bit','boolean','both',
  'case','cast','char','character','check','collate','column','constraint',
  'create','cross','current_catalog','current_date','current_role',
  'current_schema','current_time','current_timestamp','current_user',
  'dec','decimal','default','deferrable','desc','distinct','do',
  'else','end','except','false','fetch','float','for','foreign',
  'freeze','from','full','grant','group','having',
  'ilike','in','initially','inner','intersect','into','is','isnull',
  'join','lateral','leading','left','like','limit',
  'localtime','localtimestamp',
  'natural','not','notnull','null',
  'offset','on','only','or','order','outer','over','overlaps',
  'placing','precision','primary',
  'references','returning','right','row',
  'select','session_user','similar','some','symmetric',
  'table','tablesample','then','time','timestamp','to','trailing','true',
  'union','unique','user','using',
  'variadic','verbose',
  'when','where','window','with'
];

/**
 * PII列かどうかを判定する
 * @param {string} colName
 * @returns {boolean}
 */
function pmaIsPiiColumn_(colName) {
  var lower = String(colName).toLowerCase();
  for (var i = 0; i < PMA_PII_PATTERNS.length; i++) {
    if (lower === PMA_PII_PATTERNS[i].toLowerCase() ||
        lower.indexOf(PMA_PII_PATTERNS[i].toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * セルの値の型を分類する（GAS ではすべて JS 値として取得される）
 * @param {*} val
 * @returns {string} 'string'|'number'|'boolean'|'Date'|'empty'
 */
function pmaDetectType_(val) {
  if (val === null || val === undefined || val === '') return 'empty';
  if (val instanceof Date) return 'Date';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') return 'number';
  return 'string';
}

/**
 * 1列分の型分析を行う
 * @param {Array} colValues - ヘッダーを除いたデータ値の配列（最大100件）
 * @param {string} colName - 列名（PII判定用）
 * @returns {Object} 型分析結果
 */
function pmaAnalyzeColumn_(colValues, colName) {
  var isPii = pmaIsPiiColumn_(colName);
  var typeCounts = { empty: 0, string: 0, number: 0, boolean: 0, Date: 0 };
  var maxStrLen = 0;
  var hasDecimal = false;
  var samples = [];
  var nonEmptyCount = 0;

  for (var i = 0; i < colValues.length; i++) {
    var val = colValues[i];
    var t = pmaDetectType_(val);
    typeCounts[t]++;
    if (t === 'empty') continue;
    nonEmptyCount++;

    if (t === 'string') {
      var len = String(val).length;
      if (len > maxStrLen) maxStrLen = len;
    }
    if (t === 'number') {
      if (val !== Math.floor(val)) hasDecimal = true;
    }
    if (!isPii && samples.length < 5) {
      if (t === 'Date') {
        samples.push(val.toISOString());
      } else {
        samples.push(val);
      }
    }
  }

  var nonEmptyTypes = Object.keys(typeCounts).filter(function(k) {
    return k !== 'empty' && typeCounts[k] > 0;
  });
  var isMixed = nonEmptyTypes.length > 1;

  var result = {
    nonEmptyCount: nonEmptyCount,
    totalRows: colValues.length,
    typeCounts: typeCounts,
    isMixed: isMixed,
    dominantType: nonEmptyCount === 0 ? 'empty' : nonEmptyTypes[0]
  };

  if (isMixed) {
    result.mixedTypeCounts = {};
    nonEmptyTypes.forEach(function(k) { result.mixedTypeCounts[k] = typeCounts[k]; });
  }

  if (typeCounts['string'] > 0 || typeCounts['number'] > 0) {
    if (typeCounts['string'] > 0) result.maxStrLen = maxStrLen;
    if (typeCounts['number'] > 0) result.hasDecimal = hasDecimal;
  }

  if (isPii) {
    result.pii = true;
    result.samples = ['[PII省略]'];
  } else {
    result.samples = samples;
  }

  return result;
}

/**
 * シート1枚分の全列分析を行う
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} sheetName
 * @param {string|null} primaryKeyHeader - PK列のヘッダー名（null の場合スキップ）
 * @returns {Object} シート分析結果
 */
function pmaAnalyzeSheet_(sheet, sheetName, primaryKeyHeader) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return {
      sheetName: sheetName,
      error: 'シートが空またはヘッダー行なし',
      columns: [],
      primaryKeyCheck: null
    };
  }

  // ヘッダー行取得
  var headerRange = sheet.getRange(1, 1, 1, lastCol);
  var headers = headerRange.getDisplayValues()[0].map(function(h) {
    return String(h != null ? h : '').trim();
  });

  // データ行数（ヘッダー除く、最大100行）
  var dataRowCount = Math.min(lastRow - 1, 100);
  var columns = [];

  if (dataRowCount > 0) {
    // 全列のデータをまとめて取得（API呼び出し1回）
    var dataRange = sheet.getRange(2, 1, dataRowCount, lastCol);
    var dataValues = dataRange.getValues();

    for (var colIdx = 0; colIdx < lastCol; colIdx++) {
      var colName = headers[colIdx] || ('(無名列' + (colIdx + 1) + ')');
      var colValues = dataValues.map(function(row) { return row[colIdx]; });
      var analysis = pmaAnalyzeColumn_(colValues, colName);

      // PostgreSQL 固有チェック（列レベル）
      var pgIssues = pmaCheckPgColumnName_(colName);

      columns.push({
        colIndex: colIdx + 1,
        headerName: colName,
        analysis: analysis,
        pgIssues: pgIssues
      });
    }
  } else {
    // データ行なし — ヘッダーのみ記録
    for (var h = 0; h < lastCol; h++) {
      var hName = headers[h] || ('(無名列' + (h + 1) + ')');
      columns.push({
        colIndex: h + 1,
        headerName: hName,
        analysis: { nonEmptyCount: 0, totalRows: 0, typeCounts: {}, isMixed: false, dominantType: 'empty', samples: [] },
        pgIssues: pmaCheckPgColumnName_(hName)
      });
    }
  }

  // PK検証
  var primaryKeyCheck = null;
  if (primaryKeyHeader && dataRowCount > 0) {
    var pkColIdx = headers.indexOf(primaryKeyHeader);
    if (pkColIdx === -1) {
      primaryKeyCheck = { status: 'PK_HEADER_NOT_FOUND', header: primaryKeyHeader };
    } else {
      // 全データ行（100件上限なし）でPKを確認
      var allDataRows = lastRow > 1 ? lastRow - 1 : 0;
      var pkValues = [];
      if (allDataRows > 0) {
        var pkRange = sheet.getRange(2, pkColIdx + 1, allDataRows, 1);
        var pkRaw = pkRange.getValues();
        pkValues = pkRaw.map(function(r) { return r[0]; });
      }
      var emptyPkCount = pkValues.filter(function(v) { return v === null || v === undefined || v === ''; }).length;
      var nonEmptyPkValues = pkValues.filter(function(v) { return v !== null && v !== undefined && v !== ''; });
      var uniquePkValues = {};
      var duplicatePkCount = 0;
      nonEmptyPkValues.forEach(function(v) {
        var key = String(v);
        if (uniquePkValues[key]) {
          duplicatePkCount++;
        } else {
          uniquePkValues[key] = true;
        }
      });
      var samplePkValues = nonEmptyPkValues.slice(0, 3).map(function(v) {
        return v instanceof Date ? v.toISOString() : v;
      });
      primaryKeyCheck = {
        header: primaryKeyHeader,
        colIndex: pkColIdx + 1,
        totalRows: allDataRows,
        emptyPkCount: emptyPkCount,
        duplicatePkCount: duplicatePkCount,
        isValid: emptyPkCount === 0 && duplicatePkCount === 0,
        sampleValues: samplePkValues
      };
    }
  }

  return {
    sheetName: sheetName,
    headerCount: lastCol,
    dataRowCount: dataRowCount,
    totalDataRows: lastRow > 1 ? lastRow - 1 : 0,
    columns: columns,
    primaryKeyCheck: primaryKeyCheck
  };
}

/**
 * 列名のPostgreSQL固有問題をチェックする
 * @param {string} colName
 * @returns {Array<string>} 問題のリスト
 */
function pmaCheckPgColumnName_(colName) {
  var issues = [];
  var lower = String(colName).toLowerCase();

  // 63文字制限
  if (colName.length > 63) {
    issues.push('EXCEEDS_63_CHARS:' + colName.length);
  }

  // 先頭が数字
  if (/^[0-9]/.test(colName)) {
    issues.push('STARTS_WITH_DIGIT');
  }

  // 小文字・数字・アンダースコア以外の文字（ASCII範囲のみチェック）
  // 日本語は別途フラグ
  if (/[A-Z]/.test(colName)) {
    issues.push('CONTAINS_UPPERCASE');
  }
  if (/[^a-z0-9_\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/.test(colName)) {
    // スペースや特殊文字
    if (/[\s\(\)\.\/\-]/.test(colName)) {
      issues.push('CONTAINS_SPECIAL_CHARS');
    }
  }
  // 日本語文字を含む
  if (/[\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/.test(colName)) {
    issues.push('CONTAINS_NON_ASCII');
  }

  // 予約語チェック（完全一致・大文字小文字無視）
  if (PMA_PG_RESERVED_WORDS.indexOf(lower) !== -1) {
    issues.push('PG_RESERVED_WORD');
  }

  return issues;
}

/**
 * FK検証を行う（指定された参照関係について孤児レコード数を数える）
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} refSheetName - 参照元シート名
 * @param {string} refColHeader - 参照元列ヘッダー名
 * @param {string} targetSheetName - 参照先シート名
 * @param {string} targetColHeader - 参照先列ヘッダー名（PK）
 * @returns {Object} FK検証結果
 */
function pmaCheckForeignKey_(ss, refSheetName, refColHeader, targetSheetName, targetColHeader) {
  var result = {
    refSheet: refSheetName,
    refColumn: refColHeader,
    targetSheet: targetSheetName,
    targetColumn: targetColHeader,
    status: null,
    refTotalRows: 0,
    refNullOrEmptyCount: 0,
    orphanCount: 0,
    targetValueCount: 0
  };

  var refSheet = ss.getSheetByName(refSheetName);
  if (!refSheet) {
    result.status = 'REF_SHEET_NOT_FOUND';
    return result;
  }
  var targetSheet = ss.getSheetByName(targetSheetName);
  if (!targetSheet) {
    result.status = 'TARGET_SHEET_NOT_FOUND';
    return result;
  }

  // 参照元シートの列インデックスを特定
  var refLastCol = refSheet.getLastColumn();
  var refLastRow = refSheet.getLastRow();
  if (refLastRow < 2 || refLastCol < 1) {
    result.status = 'REF_SHEET_EMPTY';
    return result;
  }
  var refHeaders = refSheet.getRange(1, 1, 1, refLastCol).getDisplayValues()[0].map(function(h) {
    return String(h != null ? h : '').trim();
  });
  var refColIdx = refHeaders.indexOf(refColHeader);
  if (refColIdx === -1) {
    result.status = 'REF_COLUMN_NOT_FOUND';
    return result;
  }

  // 参照先シートのPK列を取得してセットを作成
  var targetLastCol = targetSheet.getLastColumn();
  var targetLastRow = targetSheet.getLastRow();
  if (targetLastRow < 2 || targetLastCol < 1) {
    result.status = 'TARGET_SHEET_EMPTY';
    return result;
  }
  var targetHeaders = targetSheet.getRange(1, 1, 1, targetLastCol).getDisplayValues()[0].map(function(h) {
    return String(h != null ? h : '').trim();
  });
  var targetColIdx = targetHeaders.indexOf(targetColHeader);
  if (targetColIdx === -1) {
    result.status = 'TARGET_COLUMN_NOT_FOUND';
    return result;
  }

  var targetDataRows = targetLastRow - 1;
  var targetPkRange = targetSheet.getRange(2, targetColIdx + 1, targetDataRows, 1);
  var targetPkRaw = targetPkRange.getValues();
  var targetPkSet = {};
  targetPkRaw.forEach(function(r) {
    var v = r[0];
    if (v !== null && v !== undefined && v !== '') {
      targetPkSet[String(v)] = true;
    }
  });
  result.targetValueCount = Object.keys(targetPkSet).length;

  // 参照元の参照列を取得して孤児カウント
  var refDataRows = refLastRow - 1;
  var refColRange = refSheet.getRange(2, refColIdx + 1, refDataRows, 1);
  var refColRaw = refColRange.getValues();

  result.refTotalRows = refDataRows;
  var orphanCount = 0;
  var nullOrEmptyCount = 0;

  refColRaw.forEach(function(r) {
    var v = r[0];
    if (v === null || v === undefined || v === '') {
      nullOrEmptyCount++;
    } else {
      if (!targetPkSet[String(v)]) {
        orphanCount++;
      }
    }
  });

  result.refNullOrEmptyCount = nullOrEmptyCount;
  result.orphanCount = orphanCount;
  result.status = 'OK';

  return result;
}

/**
 * メイン分析関数: 全22シートを分析して結果をJSONで返す
 * GAS実行時間 6分制限に注意。大量データ時はサブ関数を使う。
 *
 * @returns {string} JSON形式の分析結果
 */
function devPostgresMigrationAnalysisStage1() {
  if (getEnvironment() !== 'development') {
    throw new Error('devPostgresMigrationAnalysisStage1 は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();

  // 22シートの定義（シート名、PK列ヘッダー名）
  var sheetDefs = [
    { name: 'リード管理',       pkHeader: 'lead_id' },
    { name: '顧客マスタ',       pkHeader: '顧客ID' },
    { name: '担当者マスタ',     pkHeader: 'staff_id' },
    { name: 'ログインセッション', pkHeader: 'session_id' },
    { name: 'オーダー管理',     pkHeader: 'オーダーID' },
    { name: 'オーダー明細',     pkHeader: 'order_line_id' },
    { name: '発送',             pkHeader: 'shipment_id' },
    { name: '仕入れ',           pkHeader: 'purchase_id' },
    { name: '見積もり管理',     pkHeader: '見積書ID' },
    { name: '見積もり明細',     pkHeader: 'quote_line_id' },
    { name: '配送先マスタ',     pkHeader: 'shipping_destination_id' },
    { name: '支払先マスタ',     pkHeader: 'payment_destination_id' },
    { name: '共用在庫',         pkHeader: null },
    { name: '商品マスタ同期',   pkHeader: 'product_id' },
    { name: '作品マスタ_共用在庫', pkHeader: null },
    { name: '国マスタ',         pkHeader: 'country_code' },
    { name: '通貨マスタ',       pkHeader: 'currency_code' },
    { name: '流入元マスタ',     pkHeader: 'source_id' },
    { name: '選択肢マスタ',     pkHeader: null },
    { name: '発行元マスタ',     pkHeader: 'issuer_id' },
    { name: '会話ログ（商談用）', pkHeader: 'ログID' },
    { name: 'システム設定',     pkHeader: 'setting_key' }
  ];

  var sheetResults = [];

  for (var i = 0; i < sheetDefs.length; i++) {
    var def = sheetDefs[i];
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheetResults.push({
        sheetName: def.name,
        error: 'SHEET_NOT_FOUND',
        columns: [],
        primaryKeyCheck: null
      });
      continue;
    }
    sheetResults.push(pmaAnalyzeSheet_(sheet, def.name, def.pkHeader));
  }

  // FK検証
  var fkDefs = [
    { refSheet: '顧客マスタ',     refCol: '源流リードID',          targetSheet: 'リード管理',   targetCol: 'lead_id' },
    { refSheet: '顧客マスタ',     refCol: 'sales_assignee_id',     targetSheet: '担当者マスタ', targetCol: 'staff_id' },
    { refSheet: 'オーダー明細',   refCol: 'order_id',              targetSheet: 'オーダー管理', targetCol: 'オーダーID' },
    { refSheet: '見積もり管理',   refCol: '顧客ID',                targetSheet: '顧客マスタ',   targetCol: '顧客ID' },
    { refSheet: '見積もり明細',   refCol: 'quote_id',              targetSheet: '見積もり管理', targetCol: '見積書ID' },
    { refSheet: '配送先マスタ',   refCol: 'customer_id',           targetSheet: '顧客マスタ',   targetCol: '顧客ID' },
    { refSheet: '支払先マスタ',   refCol: 'customer_id',           targetSheet: '顧客マスタ',   targetCol: '顧客ID' },
    { refSheet: '発送',           refCol: 'order_id',              targetSheet: 'オーダー管理', targetCol: 'オーダーID' },
    { refSheet: '仕入れ',         refCol: 'order_id',              targetSheet: 'オーダー管理', targetCol: 'オーダーID' },
    { refSheet: '共用在庫',       refCol: 'product_id',            targetSheet: '商品マスタ同期', targetCol: 'product_id' }
  ];

  var foreignKeyResults = fkDefs.map(function(def) {
    return pmaCheckForeignKey_(ss, def.refSheet, def.refCol, def.targetSheet, def.targetCol);
  });

  // 追加FK: *_id 列と他シートのPKの突合（自動検出）
  // 各シートのヘッダーを収集してID列を抽出
  var allSheetHeaders = {};
  sheetResults.forEach(function(sr) {
    if (!sr.error) {
      allSheetHeaders[sr.sheetName] = sr.columns.map(function(c) { return c.headerName; });
    }
  });

  // 重複列検出（同名列が複数シートに存在するもの）
  var colOccurrences = {};
  Object.keys(allSheetHeaders).forEach(function(sheetName) {
    allSheetHeaders[sheetName].forEach(function(colName) {
      if (!colOccurrences[colName]) colOccurrences[colName] = [];
      colOccurrences[colName].push(sheetName);
    });
  });
  var duplicateColumns = [];
  Object.keys(colOccurrences).forEach(function(colName) {
    if (colOccurrences[colName].length > 1) {
      duplicateColumns.push({
        columnName: colName,
        appearsIn: colOccurrences[colName]
      });
    }
  });

  // ID列と名前列が同一シートに共存するシートを検出
  var idNameCoexistence = [];
  Object.keys(allSheetHeaders).forEach(function(sheetName) {
    var cols = allSheetHeaders[sheetName];
    var idCols = cols.filter(function(c) { return /_id$/i.test(c) || /ID$/.test(c); });
    var nameCols = cols.filter(function(c) {
      return /_name$/i.test(c) || /名$/.test(c) || /名称$/.test(c);
    });
    if (idCols.length > 0 && nameCols.length > 0) {
      idNameCoexistence.push({
        sheetName: sheetName,
        idColumns: idCols,
        nameColumns: nameCols
      });
    }
  });

  // PostgreSQL 固有: シートレベルの集計
  var postgresReservedWordConflicts = [];
  var namingViolations = [];

  sheetResults.forEach(function(sr) {
    if (sr.error) return;
    sr.columns.forEach(function(col) {
      if (col.pgIssues && col.pgIssues.length > 0) {
        col.pgIssues.forEach(function(issue) {
          if (issue === 'PG_RESERVED_WORD') {
            postgresReservedWordConflicts.push({
              sheetName: sr.sheetName,
              colIndex: col.colIndex,
              columnName: col.headerName
            });
          } else {
            namingViolations.push({
              sheetName: sr.sheetName,
              colIndex: col.colIndex,
              columnName: col.headerName,
              issue: issue
            });
          }
        });
      }
    });
  });

  return JSON.stringify({
    analysisAt: new Date().toISOString(),
    analysisNote: 'DEV環境 読み取り専用 — 書き込み系操作なし',
    sheetResults: sheetResults,
    foreignKeyResults: foreignKeyResults,
    duplicateColumns: duplicateColumns,
    idNameCoexistence: idNameCoexistence,
    postgresReservedWordConflicts: postgresReservedWordConflicts,
    namingViolations: namingViolations
  });
}

/**
 * シート1〜8の分析のみを実行する（タイムアウト対策のサブ関数）
 * @returns {string} JSON
 */
function devPostgresMigrationAnalysisSheets1to8() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sheetDefs = [
    { name: 'リード管理',       pkHeader: 'lead_id' },
    { name: '顧客マスタ',       pkHeader: '顧客ID' },
    { name: '担当者マスタ',     pkHeader: 'staff_id' },
    { name: 'ログインセッション', pkHeader: 'session_id' },
    { name: 'オーダー管理',     pkHeader: 'オーダーID' },
    { name: 'オーダー明細',     pkHeader: 'order_line_id' },
    { name: '発送',             pkHeader: 'shipment_id' },
    { name: '仕入れ',           pkHeader: 'purchase_id' }
  ];
  return JSON.stringify({
    analysisAt: new Date().toISOString(),
    subset: 'sheets1to8',
    sheetResults: sheetDefs.map(function(def) {
      var sheet = ss.getSheetByName(def.name);
      if (!sheet) return { sheetName: def.name, error: 'SHEET_NOT_FOUND', columns: [], primaryKeyCheck: null };
      return pmaAnalyzeSheet_(sheet, def.name, def.pkHeader);
    })
  });
}

/**
 * シート9〜16の分析のみを実行する（タイムアウト対策のサブ関数）
 * @returns {string} JSON
 */
function devPostgresMigrationAnalysisSheets9to16() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sheetDefs = [
    { name: '見積もり管理',     pkHeader: '見積書ID' },
    { name: '見積もり明細',     pkHeader: 'quote_line_id' },
    { name: '配送先マスタ',     pkHeader: 'shipping_destination_id' },
    { name: '支払先マスタ',     pkHeader: 'payment_destination_id' },
    { name: '共用在庫',         pkHeader: null },
    { name: '商品マスタ同期',   pkHeader: 'product_id' },
    { name: '作品マスタ_共用在庫', pkHeader: null },
    { name: '国マスタ',         pkHeader: 'country_code' }
  ];
  return JSON.stringify({
    analysisAt: new Date().toISOString(),
    subset: 'sheets9to16',
    sheetResults: sheetDefs.map(function(def) {
      var sheet = ss.getSheetByName(def.name);
      if (!sheet) return { sheetName: def.name, error: 'SHEET_NOT_FOUND', columns: [], primaryKeyCheck: null };
      return pmaAnalyzeSheet_(sheet, def.name, def.pkHeader);
    })
  });
}

/**
 * シート17〜22の分析 + FK + 重複検出 + PG固有チェックを実行する（タイムアウト対策のサブ関数）
 * @returns {string} JSON
 */
function devPostgresMigrationAnalysisSheets17to22() {
  if (getEnvironment() !== 'development') {
    throw new Error('DEV 環境でのみ実行できます');
  }
  var ss = getSpreadsheet();
  var sheetDefs = [
    { name: '通貨マスタ',       pkHeader: 'currency_code' },
    { name: '流入元マスタ',     pkHeader: 'source_id' },
    { name: '選択肢マスタ',     pkHeader: null },
    { name: '発行元マスタ',     pkHeader: 'issuer_id' },
    { name: '会話ログ（商談用）', pkHeader: 'ログID' },
    { name: 'システム設定',     pkHeader: 'setting_key' }
  ];

  var sheetResults = sheetDefs.map(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) return { sheetName: def.name, error: 'SHEET_NOT_FOUND', columns: [], primaryKeyCheck: null };
    return pmaAnalyzeSheet_(sheet, def.name, def.pkHeader);
  });

  // FK検証（17〜22シートに関連するもの）
  var fkDefs = [
    { refSheet: '顧客マスタ',   refCol: '源流リードID',      targetSheet: 'リード管理',   targetCol: 'lead_id' },
    { refSheet: '顧客マスタ',   refCol: 'sales_assignee_id', targetSheet: '担当者マスタ', targetCol: 'staff_id' },
    { refSheet: 'オーダー明細', refCol: 'order_id',          targetSheet: 'オーダー管理', targetCol: 'オーダーID' },
    { refSheet: '見積もり管理', refCol: '顧客ID',            targetSheet: '顧客マスタ',   targetCol: '顧客ID' },
    { refSheet: '見積もり明細', refCol: 'quote_id',          targetSheet: '見積もり管理', targetCol: '見積書ID' },
    { refSheet: '配送先マスタ', refCol: 'customer_id',       targetSheet: '顧客マスタ',   targetCol: '顧客ID' },
    { refSheet: '支払先マスタ', refCol: 'customer_id',       targetSheet: '顧客マスタ',   targetCol: '顧客ID' },
    { refSheet: '発送',         refCol: 'order_id',          targetSheet: 'オーダー管理', targetCol: 'オーダーID' },
    { refSheet: '仕入れ',       refCol: 'order_id',          targetSheet: 'オーダー管理', targetCol: 'オーダーID' },
    { refSheet: '共用在庫',     refCol: 'product_id',        targetSheet: '商品マスタ同期', targetCol: 'product_id' }
  ];

  var foreignKeyResults = fkDefs.map(function(def) {
    return pmaCheckForeignKey_(ss, def.refSheet, def.refCol, def.targetSheet, def.targetCol);
  });

  return JSON.stringify({
    analysisAt: new Date().toISOString(),
    subset: 'sheets17to22_plus_fk',
    sheetResults: sheetResults,
    foreignKeyResults: foreignKeyResults
  });
}
