/**
 * システム設定シートセットアップ
 *
 * Core Schema V1 の SETTINGS に対応する物理シートを作成・初期データ投入する。
 *
 * ★ このファイルの関数以外でシートを作成・削除・上書きしてはならない。
 * ★ 実行タイミングはオーナーの指示を待つこと。
 */

/**
 * 「システム設定」シートを作成する。
 *
 * - 既に存在する場合は何もしない
 * - ヘッダーは Core Schema V1 の定義から生成する（物理名を直書きしない）
 * - LockService で保護する
 *
 * @returns {{ status: 'CREATED'|'ALREADY_EXISTS', sheetName: string, columns?: number }}
 */
function setupSystemSettingsSheet() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = getSpreadsheet();
    var table = CORE_SCHEMA_V1_TABLES['SETTINGS'];
    var sheetName = table.sheetName;

    if (ss.getSheetByName(sheetName)) {
      Logger.log('[setupSystemSettingsSheet] ' + sheetName + ' は既に存在します。スキップ。');
      return { status: 'ALREADY_EXISTS', sheetName: sheetName };
    }

    var headerNames = Object.keys(table.headers).map(function(k) { return table.headers[k]; });
    var sheet = ss.insertSheet(sheetName);

    sheet.getRange(1, 1, 1, headerNames.length).setValues([headerNames]);
    sheet.getRange(1, 1, 1, headerNames.length)
      .setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);

    Logger.log('[setupSystemSettingsSheet] 作成完了: ' + sheetName + ' (' + headerNames.length + '列)');
    return { status: 'CREATED', sheetName: sheetName, columns: headerNames.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * システム設定シートに初期データを投入する。
 *
 * - 対象キーが既に存在する行はスキップする（上書きしない）
 * - シートが存在しない場合はエラーを返す（setupSystemSettingsSheet を先に実行すること）
 * - LockService で保護する
 *
 * 初期データ:
 *   見積もり有効期限日数 | 30     | 数値
 *   REMINDER_ENABLED     | true   | 真偽値
 *
 * @returns {{ seeded: string[], skipped: string[], error?: string }}
 */
function seedSystemSettings() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = getSpreadsheet();
    var table = CORE_SCHEMA_V1_TABLES['SETTINGS'];

    var sheet;
    try {
      sheet = getCoreSchemaV1Sheet(ss, 'SETTINGS');
    } catch (e) {
      var msg = 'システム設定シートが見つかりません。setupSystemSettingsSheet を先に実行してください。';
      Logger.log('[seedSystemSettings] ' + msg);
      return { seeded: [], skipped: [], error: msg };
    }

    var headers = table.headers;
    var keyColName   = headers['SETTING_KEY'];
    var valColName   = headers['SETTING_VALUE'];
    var typeColName  = headers['VALUE_TYPE'];
    var descColName  = headers['DESCRIPTION'];
    var tsColName    = headers['UPDATED_AT'];

    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var keyColIdx  = headerRow.indexOf(keyColName);
    var valColIdx  = headerRow.indexOf(valColName);
    var typeColIdx = headerRow.indexOf(typeColName);
    var descColIdx = headerRow.indexOf(descColName);
    var tsColIdx   = headerRow.indexOf(tsColName);

    if (keyColIdx < 0 || valColIdx < 0 || typeColIdx < 0) {
      var headerMsg = 'ヘッダー列が見つかりません。シートの構造を確認してください。';
      Logger.log('[seedSystemSettings] ' + headerMsg);
      return { seeded: [], skipped: [], error: headerMsg };
    }

    // 既存キーを収集
    var existingKeys = {};
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var existingData = sheet.getRange(2, keyColIdx + 1, lastRow - 1, 1).getValues();
      existingData.forEach(function(row) {
        if (row[0]) existingKeys[String(row[0])] = true;
      });
    }

    var now = new Date().toISOString();
    var seeds = [
      {
        key:         '見積もり有効期限日数',
        value:       '30',
        valueType:   table.values.VALUE_TYPE.NUMBER,
        description: '見積書の有効期限を発行日から何日後に設定するか'
      },
      {
        key:         'REMINDER_ENABLED',
        value:       'true',
        valueType:   table.values.VALUE_TYPE.BOOLEAN,
        description: 'リマインダー通知の有効/無効フラグ'
      },
      {
        key:         'オーダー支払期日日数',
        value:       '2',
        valueType:   table.values.VALUE_TYPE.NUMBER,
        description: 'オーダーの支払期日（受注日からの日数）'
      },
      // 帳票テンプレート配色
      {
        key:         '帳票_バー背景色',
        value:       '#2f4f4f',
        valueType:   table.values.VALUE_TYPE.TEXT,
        description: '帳票ヘッダーバー・明細ヘッダーの背景色（例: #2f4f4f）'
      },
      {
        key:         '帳票_バー文字色',
        value:       '#ffffff',
        valueType:   table.values.VALUE_TYPE.TEXT,
        description: '帳票ヘッダーバー・明細ヘッダーの文字色（例: #ffffff）'
      },
      {
        key:         '帳票_会社名色',
        value:       '#2f4f4f',
        valueType:   table.values.VALUE_TYPE.TEXT,
        description: '帳票の会社名テキスト色（例: #2f4f4f）'
      },
      {
        key:         '帳票_タイトル色',
        value:       '#2f4f4f',
        valueType:   table.values.VALUE_TYPE.TEXT,
        description: '帳票のドキュメントタイトル（Invoice / Quotation）の色（例: #2f4f4f）'
      },
      {
        key:         '帳票_結び文色',
        value:       '#2f4f4f',
        valueType:   table.values.VALUE_TYPE.TEXT,
        description: '帳票末尾の "Thank you for your business!" の文字色（例: #2f4f4f）'
      },
      { key: '帳票_見積書保存先フォルダID', value: '', valueType: table.values.VALUE_TYPE.TEXT, description: '見積書の保存先Google DriveフォルダID' },
      { key: '帳票_請求書保存先フォルダID', value: '', valueType: table.values.VALUE_TYPE.TEXT, description: '請求書の保存先Google DriveフォルダID' },
      { key: '帳票_発送ラベル保存先フォルダID', value: '', valueType: table.values.VALUE_TYPE.TEXT, description: '発送ラベルの保存先Google DriveフォルダID' },
      { key: '帳票_仕入請求書保存先フォルダID', value: '', valueType: table.values.VALUE_TYPE.TEXT, description: '仕入請求書の保存先Google DriveフォルダID' }
      }
    ];

    var seeded = [];
    var skipped = [];
    var colCount = headerRow.length;

    seeds.forEach(function(seed) {
      if (existingKeys[seed.key]) {
        Logger.log('[seedSystemSettings] スキップ（既存）: ' + seed.key);
        skipped.push(seed.key);
        return;
      }

      var row = new Array(colCount).fill('');
      row[keyColIdx]  = seed.key;
      row[valColIdx]  = seed.value;
      row[typeColIdx] = seed.valueType;
      if (descColIdx >= 0) row[descColIdx] = seed.description;
      if (tsColIdx   >= 0) row[tsColIdx]   = now;

      sheet.appendRow(row);
      Logger.log('[seedSystemSettings] 投入: ' + seed.key + ' = ' + seed.value + ' (' + seed.valueType + ')');
      seeded.push(seed.key);
    });

    return { seeded: seeded, skipped: skipped };
  } finally {
    lock.releaseLock();
  }
}
