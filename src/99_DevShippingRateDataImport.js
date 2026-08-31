/**
 * 99_DevShippingRateDataImport.js
 *
 * 目的: 既存の横持ちシート（地帯表 / FedEx送料 / DHL送料 / UPS送料）から
 *       3マスタ（配送会社マスタ / 地帯マスタ / 送料表マスタ）へデータを変換投入する。
 *       読み取り専用の DRY_RUN と、実際にデータを書き込む APPLY の2モードを持つ。
 *
 * 禁止事項:
 *   - PROD 環境での実行
 *   - 既存データへの上書き（データ行がある場合は停止）
 *   - 未マッチ国が20件超の場合も停止
 *
 * 使い方:
 *   clasp run importShippingRateData --params '["DRY_RUN"]'
 *   clasp run importShippingRateData --params '["APPLY"]'
 *
 * 前提条件:
 *   - setupShippingRateMasterSheets("APPLY") で3シートが作成済みであること
 *   - DEV スプレッドシートに「地帯表」「FedEx送料」「DHL送料」「UPS送料」が存在すること
 */

/** 横持ちソースシート名 */
var IMPORT_SOURCE_SHEET_NAMES = {
  ZONES:  '地帯表',
  FEDEX:  'FedEx送料',
  DHL:    'DHL送料',
  UPS:    'UPS送料'
};

/**
 * 配送会社定義（固定データ）
 * zoneCol: 地帯表の列インデックス (0-based)
 */
var CARRIER_DEFINITIONS = [
  { id: 'CAR-0001', name: 'FedEx', zoneCol: 2, divisor: 5000, roundingUnit: 0,   rateSheetKey: 'FEDEX' },
  { id: 'CAR-0002', name: 'DHL',   zoneCol: 3, divisor: 5000, roundingUnit: 0.5, rateSheetKey: 'DHL'   },
  { id: 'CAR-0003', name: 'UPS',   zoneCol: 4, divisor: 5000, roundingUnit: 0.5, rateSheetKey: 'UPS'   }
];

/**
 * 既存の横持ちシートから3マスタへデータを変換投入する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function importShippingRateData(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('importShippingRateData は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();
  var now = new Date().toISOString();

  // --- 1. 国マスタから名前→ISO2コードのマッピングを構築 ---
  var countryMapping = _buildCountryMapping(ss);

  // --- 2. 配送会社マスタ行を構築（固定3件） ---
  var carriersRows = _buildCarriersRows(now);

  // --- 3. 地帯マスタ行を構築（地帯表から変換） ---
  var zonesResult = _buildZonesRows(ss, countryMapping, now);
  var zonesRows = zonesResult.rows;
  var unmatchedCountries = zonesResult.unmatched;

  if (unmatchedCountries.length > 20) {
    throw new Error(
      '未マッチ国が20件を超えました (' + unmatchedCountries.length + '件)。処理を中止します。\n' +
      '未マッチ国（先頭5件）: ' + unmatchedCountries.slice(0, 5).join(', ')
    );
  }

  // --- 4. 送料表マスタ行を構築（FedEx/DHL/UPS送料から変換） ---
  var ratesRows = _buildRatesRows(ss, now);

  // --- ログ出力 ---
  Logger.log('=== importShippingRateData (' + mode + ') ===');
  Logger.log('');
  Logger.log('【配送会社マスタ】投入予定: ' + carriersRows.length + '件');
  carriersRows.slice(0, 3).forEach(function(r) {
    Logger.log('  ' + JSON.stringify(r));
  });
  Logger.log('');
  Logger.log('【地帯マスタ】投入予定: ' + zonesRows.length + '件');
  zonesRows.slice(0, 3).forEach(function(r) {
    Logger.log('  ' + JSON.stringify(r));
  });
  Logger.log('');
  Logger.log('【送料表マスタ】投入予定: ' + ratesRows.length + '件');
  ratesRows.slice(0, 3).forEach(function(r) {
    Logger.log('  ' + JSON.stringify(r));
  });
  if (unmatchedCountries.length > 0) {
    Logger.log('');
    Logger.log('【未マッチ国: ' + unmatchedCountries.length + '件】');
    unmatchedCountries.forEach(function(c) {
      Logger.log('  ' + c);
    });
  }

  if (mode === 'DRY_RUN') {
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際の書き込みは行っていません。');
    return {
      mode: 'DRY_RUN',
      carriers: { count: carriersRows.length, preview: carriersRows.slice(0, 3) },
      zones:    { count: zonesRows.length,    preview: zonesRows.slice(0, 3),    unmatched: unmatchedCountries },
      rates:    { count: ratesRows.length,    preview: ratesRows.slice(0, 3) }
    };
  }

  // --- APPLY: 二重投入防止チェック ---
  var carriersSheet = ss.getSheetByName(getCoreSchemaV1TableName('CARRIERS'));
  var zonesSheet    = ss.getSheetByName(getCoreSchemaV1TableName('ZONES'));
  var ratesSheet    = ss.getSheetByName(getCoreSchemaV1TableName('SHIPPING_RATES'));

  if (!carriersSheet || !zonesSheet || !ratesSheet) {
    throw new Error(
      'マスタシートが見つかりません。先に setupShippingRateMasterSheets("APPLY") を実行してください。'
    );
  }

  var carriersDataRows = Math.max(carriersSheet.getLastRow() - 1, 0);
  var zonesDataRows    = Math.max(zonesSheet.getLastRow() - 1, 0);
  var ratesDataRows    = Math.max(ratesSheet.getLastRow() - 1, 0);

  if (carriersDataRows > 0 || zonesDataRows > 0 || ratesDataRows > 0) {
    throw new Error(
      '既存データが存在します。二重投入を防止するため処理を中止します。\n' +
      '配送会社マスタ: ' + carriersDataRows + '行\n' +
      '地帯マスタ: '    + zonesDataRows    + '行\n' +
      '送料表マスタ: '  + ratesDataRows    + '行'
    );
  }

  // --- データ書き込み ---
  _writeRows(carriersSheet, 'CARRIERS',       carriersRows);
  Logger.log('配送会社マスタ: ' + carriersRows.length + '件 書き込み完了');

  _writeRows(zonesSheet,    'ZONES',          zonesRows);
  Logger.log('地帯マスタ: '    + zonesRows.length    + '件 書き込み完了');

  _writeRows(ratesSheet,    'SHIPPING_RATES', ratesRows);
  Logger.log('送料表マスタ: '  + ratesRows.length    + '件 書き込み完了');

  Logger.log('');
  Logger.log('APPLY 完了。');

  return {
    mode: 'APPLY',
    carriers: { written: carriersRows.length },
    zones:    { written: zonesRows.length,    unmatched: unmatchedCountries },
    rates:    { written: ratesRows.length }
  };
}

// ============================================================
// 内部ヘルパー関数
// ============================================================

/**
 * 国マスタから「英語名 → ISO2コード」と「日本語名 → ISO2コード」の
 * マッピングを構築する。
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {{ byEnglish: Object, byJapanese: Object }}
 */
function _buildCountryMapping(ss) {
  var table  = getCoreSchemaV1Table('COUNTRIES');
  var sheet  = ss.getSheetByName(table.sheetName);
  if (!sheet) {
    throw new Error('国マスタシートが見つかりません: ' + table.sheetName);
  }

  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    throw new Error('国マスタシートが空です: ' + table.sheetName);
  }

  var allData    = sheet.getDataRange().getValues();
  var headerRow  = allData[0];
  var dataRows   = allData.slice(1);

  var codeColName    = table.headers['COUNTRY_CODE'];
  var displayColName = table.headers['DISPLAY_NAME'];
  var nameJaColName  = table.headers['NAME_JA'];

  var codeIdx    = headerRow.indexOf(codeColName);
  var displayIdx = headerRow.indexOf(displayColName);
  var nameJaIdx  = headerRow.indexOf(nameJaColName);

  if (codeIdx < 0) {
    throw new Error('国マスタに列 "' + codeColName + '" が見つかりません');
  }
  if (displayIdx < 0) {
    throw new Error('国マスタに列 "' + displayColName + '" が見つかりません');
  }

  var byEnglish  = {};
  var byJapanese = {};

  dataRows.forEach(function(row) {
    var code    = String(row[codeIdx]    || '').trim();
    var display = String(row[displayIdx] || '').trim();
    var nameJa  = nameJaIdx >= 0 ? String(row[nameJaIdx] || '').trim() : '';

    if (!code) return;
    if (display)  byEnglish[display.toLowerCase()]  = code;
    if (nameJa)   byJapanese[nameJa]                = code;
  });

  return { byEnglish: byEnglish, byJapanese: byJapanese };
}

/**
 * 配送会社マスタの行データを生成する（固定3件）。
 *
 * @param {string} now - ISO8601 タイムスタンプ
 * @returns {Array<Object>}
 */
function _buildCarriersRows(now) {
  return CARRIER_DEFINITIONS.map(function(def) {
    return {
      CARRIER_ID:          def.id,
      NAME:                def.name,
      VOLUMETRIC_DIVISOR:  def.divisor,
      ROUNDING_UNIT:       def.roundingUnit,
      ACTIVE:              true,
      REGISTERED_AT:       now,
      UPDATED_AT:          now
    };
  });
}

/**
 * 地帯表から地帯マスタの行データを生成する。
 *
 * 地帯表の列構成:
 *   col0: 国（日本語名）
 *   col1: Country（英語名）
 *   col2: FedEx ゾーン
 *   col3: DHL ゾーン
 *   col4: UPS ゾーン
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {{ byEnglish: Object, byJapanese: Object }} countryMapping
 * @param {string} now
 * @returns {{ rows: Array<Object>, unmatched: Array<string> }}
 */
function _buildZonesRows(ss, countryMapping, now) {
  var sheetName = IMPORT_SOURCE_SHEET_NAMES.ZONES;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('ソースシートが見つかりません: ' + sheetName);
  }

  var allData  = sheet.getDataRange().getValues();
  var dataRows = allData.slice(1); // 1行目はヘッダー

  var rows       = [];
  var unmatched  = [];
  var idCounter  = 1;

  dataRows.forEach(function(srcRow) {
    var nameJa = String(srcRow[0] || '').trim();
    var nameEn = String(srcRow[1] || '').trim();

    if (!nameJa && !nameEn) return; // 空行スキップ

    // 国コード解決: 英語名優先、次に日本語名
    var countryCode = null;
    if (nameEn) {
      countryCode = countryMapping.byEnglish[nameEn.toLowerCase()] || null;
    }
    if (!countryCode && nameJa) {
      countryCode = countryMapping.byJapanese[nameJa] || null;
    }

    if (!countryCode) {
      unmatched.push((nameJa || '') + ' / ' + (nameEn || ''));
      return;
    }

    CARRIER_DEFINITIONS.forEach(function(def) {
      var zone = String(srcRow[def.zoneCol] || '').trim();
      if (!zone) return; // このキャリアのゾーンが空ならスキップ

      rows.push({
        ZONE_ID:       'ZON-' + _padId(idCounter),
        CARRIER_ID:    def.id,
        COUNTRY_CODE:  countryCode,
        ZONE:          zone,
        ACTIVE:        true,
        REGISTERED_AT: now,
        UPDATED_AT:    now
      });
      idCounter++;
    });
  });

  return { rows: rows, unmatched: unmatched };
}

/**
 * FedEx/DHL/UPS送料シートから送料表マスタの行データを生成する。
 *
 * 送料シートの列構成:
 *   col0: Min_Weight（最小重量）
 *   col1: Max_Weight（最大重量）
 *   col2以降: ゾーン列（ヘッダー行にゾーン識別子）
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} now
 * @returns {Array<Object>}
 */
function _buildRatesRows(ss, now) {
  var rows      = [];
  var idCounter = 1;

  CARRIER_DEFINITIONS.forEach(function(def) {
    var sheetName = IMPORT_SOURCE_SHEET_NAMES[def.rateSheetKey];
    var sheet     = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('送料ソースシートが見つかりません: ' + sheetName);
    }

    var allData     = sheet.getDataRange().getValues();
    var headerRow   = allData[0];
    var dataRows    = allData.slice(1);

    // ゾーン列のヘッダー（col2以降）
    var zoneHeaders = headerRow.slice(2);

    dataRows.forEach(function(srcRow) {
      var rawMin = srcRow[0];
      var rawMax = srcRow[1];

      // 最小重量が空の行はスキップ
      if (rawMin === '' || rawMin === null || rawMin === undefined) return;

      var minWeight = Number(rawMin);
      var maxWeight = Number(rawMax);

      if (isNaN(minWeight)) return;

      zoneHeaders.forEach(function(zoneHeader, idx) {
        var zone = String(zoneHeader || '').trim();
        if (!zone) return;

        var rawRate = srcRow[idx + 2];
        if (rawRate === '' || rawRate === null || rawRate === undefined) return;

        var rate = Number(rawRate);
        if (isNaN(rate)) return;

        rows.push({
          RATE_ID:       'RAT-' + _padId(idCounter),
          CARRIER_ID:    def.id,
          ZONE:          zone,
          MIN_WEIGHT:    minWeight,
          MAX_WEIGHT:    maxWeight,
          RATE:          rate,
          ACTIVE:        true,
          REGISTERED_AT: now,
          UPDATED_AT:    now
        });
        idCounter++;
      });
    });
  });

  return rows;
}

/**
 * 行データをシートに書き込む。
 * 列の順序は CoreSchemaRegistry の headers キー順に従う。
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} tableKey - CORE_SCHEMA_V1_TABLES のキー
 * @param {Array<Object>} rows - headerKey → value のオブジェクト配列
 */
function _writeRows(sheet, tableKey, rows) {
  if (rows.length === 0) return;

  var headerKeys = Object.keys(getCoreSchemaV1Table(tableKey).headers);
  var values = rows.map(function(row) {
    return headerKeys.map(function(key) {
      var v = row[key];
      return v === undefined ? '' : v;
    });
  });

  var startRow = sheet.getLastRow() + 1; // ヘッダー行の次から
  sheet.getRange(startRow, 1, values.length, headerKeys.length).setValues(values);
}

/**
 * 連番を4桁ゼロパディングした文字列に変換する。
 *
 * @param {number} n
 * @returns {string}
 */
function _padId(n) {
  return ('0000' + n).slice(-4);
}
