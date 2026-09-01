/**
 * 99_DevConditionMasterSetup.js
 *
 * 目的: コンディションマスタ（CONDITIONS）を DEV スプレッドシートに新設し、
 *       共用在庫（SHARED_INVENTORY）の CONDITION 8値に加え、
 *       自社管理用の Single 値を含む計9件の初期データを登録する。
 *
 * 【設計意図】
 *   - 由来 SHARED は共用在庫（外部同期）から来る値。
 *     crm-app がこの一覧を正本とし、共有先に合わせてもらう方針。
 *   - 由来 OWN は自社独自に追加する値。共用在庫の同期に影響しない。
 *   - CND-0009（FLAG_SINGLE）は共有先の不具合による値。
 *     本来は CND-0008（Single）。共有先が修正すれば使われなくなる。
 *   - SQL 移行時、対応単位と由来は ENUM または参照テーブルになる。
 *
 * 禁止事項:
 *   - 既存シートの変更・削除・上書き
 *   - PROD 環境での実行
 *
 * 使い方:
 *   clasp run setupConditionMaster --params '["DRY_RUN"]'
 *   clasp run setupConditionMaster --params '["APPLY"]'
 */

var CONDITION_MASTER_TABLE_KEY = 'CONDITIONS';

/** 初期データ（9件）。由来はすべて SHARED。 */
var CONDITION_MASTER_INITIAL_DATA = [
  { id: 'CND-0001', value: 'Case',               nameJa: 'ケース',                   unit: 'ケース',  origin: 'SHARED', shippingTarget: true },
  { id: 'CND-0002', value: 'Damaged case',        nameJa: 'ダメージケース',             unit: 'ケース',  origin: 'SHARED', shippingTarget: true },
  { id: 'CND-0003', value: 'Sealed box',          nameJa: 'シュリンク付きボックス',      unit: 'ボックス', origin: 'SHARED', shippingTarget: true },
  { id: 'CND-0004', value: 'Damaged sealed box',  nameJa: 'ダメージシュリンクボックス',   unit: 'ボックス', origin: 'SHARED', shippingTarget: true },
  { id: 'CND-0005', value: 'No shrink box',       nameJa: 'シュリンクなしボックス',      unit: 'ボックス', origin: 'SHARED', shippingTarget: true },
  { id: 'CND-0006', value: 'Searched pack',       nameJa: 'サーチ済みパック',           unit: 'パック',  origin: 'SHARED', shippingTarget: true },
  { id: 'CND-0007', value: 'Unsearched pack',     nameJa: '未サーチパック',             unit: 'パック',  origin: 'SHARED', shippingTarget: true },
  { id: 'CND-0008', value: 'Single',              nameJa: 'シングル',                  unit: '対象外',  origin: 'SHARED', shippingTarget: false },
  { id: 'CND-0009', value: 'FLAG_SINGLE',         nameJa: 'シングル（旧値）',           unit: '対象外',  origin: 'SHARED', shippingTarget: false }
];

/**
 * コンディションマスタを DRY_RUN または APPLY する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function setupConditionMaster(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('setupConditionMaster は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();
  var table = getCoreSchemaV1Table(CONDITION_MASTER_TABLE_KEY);
  var sheetName = table.sheetName;
  var headers = Object.values(table.headers);
  var alreadyExists = ss.getSheetByName(sheetName) !== null;

  Logger.log('=== setupConditionMaster (' + mode + ') ===');
  Logger.log('');
  Logger.log('【作成予定シート: ' + (alreadyExists ? 0 : 1) + '件】');
  if (alreadyExists) {
    Logger.log('  ⚠️  ' + sheetName + ' — 既に存在します。スキップします。');
  } else {
    Logger.log('  ' + sheetName + ' (' + headers.length + '列)');
    Logger.log('    列: ' + headers.join(' / '));
  }
  Logger.log('');
  Logger.log('【登録予定データ: ' + (alreadyExists ? 0 : CONDITION_MASTER_INITIAL_DATA.length) + '件】');

  if (mode === 'DRY_RUN') {
    if (!alreadyExists) {
      CONDITION_MASTER_INITIAL_DATA.forEach(function(row) {
        Logger.log('  ' + row.id + ' | ' + row.value + ' | ' + row.nameJa + ' | ' + row.unit + ' | ' + row.origin);
      });
    }
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際のシート作成・データ登録は行っていません。');
    return {
      mode: 'DRY_RUN',
      toCreateCount: alreadyExists ? 0 : 1,
      conflictCount: alreadyExists ? 1 : 0,
      dataRowCount: alreadyExists ? 0 : CONDITION_MASTER_INITIAL_DATA.length,
      conflicts: alreadyExists ? [sheetName] : []
    };
  }

  // APPLY
  if (alreadyExists) {
    Logger.log('  ⏭️  ' + sheetName + ' は既に存在するためスキップしました。');
    Logger.log('');
    Logger.log('APPLY スキップ。既存シートは変更しませんでした。');
    return {
      mode: 'APPLY',
      createdCount: 0,
      skippedCount: 1,
      dataRowCount: 0,
      skipped: [sheetName]
    };
  }

  // シート作成
  var newSheet = ss.insertSheet(sheetName);
  newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  Logger.log('  ✅ ' + sheetName + ' を作成しました（ヘッダー ' + headers.length + '列）。');

  // 列インデックスを Registry から取得
  var conditionIdIdx    = headers.indexOf(table.headers['CONDITION_ID'])    + 1;
  var conditionValueIdx = headers.indexOf(table.headers['CONDITION_VALUE']) + 1;
  var nameJaIdx         = headers.indexOf(table.headers['NAME_JA'])         + 1;
  var unitIdx           = headers.indexOf(table.headers['UNIT'])            + 1;
  var originIdx         = headers.indexOf(table.headers['ORIGIN'])          + 1;
  var shippingTargetIdx = headers.indexOf(table.headers['SHIPPING_TARGET']) + 1;
  var activeIdx         = headers.indexOf(table.headers['ACTIVE'])          + 1;
  var registeredAtIdx   = headers.indexOf(table.headers['REGISTERED_AT'])   + 1;
  var updatedAtIdx      = headers.indexOf(table.headers['UPDATED_AT'])      + 1;

  var now = new Date();
  var nowStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // 初期データ登録
  CONDITION_MASTER_INITIAL_DATA.forEach(function(row) {
    var lastRow = newSheet.getLastRow();
    var targetRow = lastRow + 1;
    newSheet.getRange(targetRow, conditionIdIdx).setValue(row.id);
    newSheet.getRange(targetRow, conditionValueIdx).setValue(row.value);
    newSheet.getRange(targetRow, nameJaIdx).setValue(row.nameJa);
    newSheet.getRange(targetRow, unitIdx).setValue(row.unit);
    newSheet.getRange(targetRow, originIdx).setValue(row.origin);
    newSheet.getRange(targetRow, shippingTargetIdx).setValue(row.shippingTarget ? true : '');
    newSheet.getRange(targetRow, activeIdx).setValue(true);
    newSheet.getRange(targetRow, registeredAtIdx).setValue(nowStr);
    newSheet.getRange(targetRow, updatedAtIdx).setValue(nowStr);
    Logger.log('  登録: ' + row.id + ' ' + row.value);
  });

  Logger.log('');
  Logger.log('APPLY 完了。シート作成: 1件 / データ登録: ' + CONDITION_MASTER_INITIAL_DATA.length + '件');

  return {
    mode: 'APPLY',
    createdCount: 1,
    skippedCount: 0,
    dataRowCount: CONDITION_MASTER_INITIAL_DATA.length,
    created: [sheetName]
  };
}
