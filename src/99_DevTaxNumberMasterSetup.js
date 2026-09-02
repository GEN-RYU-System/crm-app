/**
 * 99_DevTaxNumberMasterSetup.js
 *
 * 目的: 番号種別マスタ（TAX_NUMBER_TYPES）と顧客税務番号（CUSTOMER_TAX_NUMBERS）を
 *       DEV スプレッドシートに新設する。
 *       番号種別マスタには初期データ7件を登録する。
 *       顧客税務番号はヘッダー行のみ作成する（初期データなし）。
 *
 * 【設計意図】
 * - 顧客マスタに列を増やさず別テーブルにした理由:
 *   顧客が複数の番号を持てるため（EU向けEORI、韓国向けPCCC など）
 * - 番号種別をマスタにした理由:
 *   各国の制度変更にシートの追加だけで対応でき、
 *   顧客向けフォームの選択肢も自動で追従する
 * - PostgreSQL 移行時: customer_tax_numbers に
 *   UNIQUE (customer_id, type_id) を付ける想定。
 *   GAS では制約を張れないため書き込み時に検証する
 * - 出典: US_TAX_ID は FedEx/UPS 公式、EORI/TAX_ID は UPS/FedEx 公式、
 *   ABN はジェトロ、PCCC は韓国税関の制度、RFC は輸入必須と確認
 * - SIN（カナダ）は eLogi CSV に例示があるが、
 *   カナダ向け通関で必須という公式情報が確認できないため入れない
 * - 番号種別ID は連番ではなく文字列コードを直接使う。
 *   フォーム側でコードを直接比較できるため。
 *
 * 禁止事項:
 *   - 既存シートの変更・削除・上書き
 *   - PROD 環境での実行
 *
 * 使い方:
 *   clasp run setupTaxNumberMaster --params '["DRY_RUN"]'
 *   clasp run setupTaxNumberMaster --params '["APPLY"]'
 */

/* global getCoreSchemaV1Table, getEnvironment, getSpreadsheet */

var TAX_NUMBER_TYPES_TABLE_KEY     = 'TAX_NUMBER_TYPES';
var CUSTOMER_TAX_NUMBERS_TABLE_KEY = 'CUSTOMER_TAX_NUMBERS';

/** 番号種別マスタ初期データ（7件）*/
var TAX_NUMBER_TYPE_INITIAL_DATA = [
  {
    typeId:        'US_TAX_ID',
    nameJa:        '米国納税者番号（EIN/SSN）',
    nameEn:        'US Tax ID (EIN/SSN)',
    description:   '法人はEIN、個人はSSN。米国の正式通関で必須',
    targetCountry: 'アメリカ'
  },
  {
    typeId:        'TAX_ID',
    nameJa:        '納税者ID番号',
    nameEn:        'Tax ID',
    description:   'EORIが不要な国で代替として使用',
    targetCountry: '汎用'
  },
  {
    typeId:        'VAT',
    nameJa:        'VAT番号',
    nameEn:        'VAT Number',
    description:   'EU域内の付加価値税登録番号',
    targetCountry: 'EU'
  },
  {
    typeId:        'EORI',
    nameJa:        'EORI番号',
    nameEn:        'EORI Number',
    description:   'EU・英国の通関で使用。事業者登録識別番号',
    targetCountry: 'EU・英国'
  },
  {
    typeId:        'ABN',
    nameJa:        '事業者番号',
    nameEn:        'Australian Business Number',
    description:   'オーストラリアの事業者番号。GST登録に必要',
    targetCountry: 'オーストラリア'
  },
  {
    typeId:        'PCCC',
    nameJa:        '個人通関固有符号',
    nameEn:        'Personal Customs Clearance Code',
    description:   '韓国の個人通関固有符号。P+12桁',
    targetCountry: '韓国'
  },
  {
    typeId:        'RFC',
    nameJa:        '納税者番号',
    nameEn:        'Registro Federal de Contribuyentes',
    description:   'メキシコの納税者番号。輸入に必須',
    targetCountry: 'メキシコ'
  }
];

/**
 * 番号種別マスタと顧客税務番号を DRY_RUN または APPLY する。
 *
 * @param {string} mode - 'DRY_RUN' または 'APPLY'
 * @returns {Object} 実行結果
 */
function setupTaxNumberMaster(mode) {
  if (mode !== 'DRY_RUN' && mode !== 'APPLY') {
    throw new Error(
      'mode は "DRY_RUN" または "APPLY" を指定してください。引数なしでは実行できません。'
    );
  }

  if (getEnvironment() !== 'development') {
    throw new Error('setupTaxNumberMaster は development 環境でのみ実行できます。');
  }

  var ss = getSpreadsheet();

  // --- TAX_NUMBER_TYPES ---
  var typesTable   = getCoreSchemaV1Table(TAX_NUMBER_TYPES_TABLE_KEY);
  var typesSheet   = typesTable.sheetName;
  var typesHeaders = Object.values(typesTable.headers);
  var typesExists  = ss.getSheetByName(typesSheet) !== null;

  // --- CUSTOMER_TAX_NUMBERS ---
  var ctnTable   = getCoreSchemaV1Table(CUSTOMER_TAX_NUMBERS_TABLE_KEY);
  var ctnSheet   = ctnTable.sheetName;
  var ctnHeaders = Object.values(ctnTable.headers);
  var ctnExists  = ss.getSheetByName(ctnSheet) !== null;

  var toCreate  = (!typesExists ? 1 : 0) + (!ctnExists ? 1 : 0);
  var conflicts = [];
  if (typesExists) conflicts.push(typesSheet);
  if (ctnExists)   conflicts.push(ctnSheet);

  Logger.log('=== setupTaxNumberMaster (' + mode + ') ===');
  Logger.log('');
  Logger.log('【作成予定シート: ' + toCreate + '件】');

  if (typesExists) {
    Logger.log('  ⚠️  ' + typesSheet + ' — 既に存在します。スキップします。');
  } else {
    Logger.log('  ' + typesSheet + ' (' + typesHeaders.length + '列)');
    Logger.log('    列: ' + typesHeaders.join(' / '));
  }
  if (ctnExists) {
    Logger.log('  ⚠️  ' + ctnSheet + ' — 既に存在します。スキップします。');
  } else {
    Logger.log('  ' + ctnSheet + ' (' + ctnHeaders.length + '列)');
    Logger.log('    列: ' + ctnHeaders.join(' / '));
  }

  Logger.log('');
  Logger.log('【登録予定データ: ' + (!typesExists ? TAX_NUMBER_TYPE_INITIAL_DATA.length : 0) + '件】');
  Logger.log('  ※ 顧客税務番号はヘッダー行のみ作成（データ登録なし）');
  Logger.log('【衝突: ' + conflicts.length + '件】');

  if (mode === 'DRY_RUN') {
    if (!typesExists) {
      TAX_NUMBER_TYPE_INITIAL_DATA.forEach(function(row) {
        Logger.log('  ' + row.typeId + ' | ' + row.nameJa + ' | ' + row.nameEn + ' | ' + row.targetCountry);
      });
    }
    Logger.log('');
    Logger.log('DRY_RUN 完了。実際のシート作成・データ登録は行っていません。');
    return {
      mode:         'DRY_RUN',
      toCreateCount: toCreate,
      conflictCount: conflicts.length,
      dataRowCount:  !typesExists ? TAX_NUMBER_TYPE_INITIAL_DATA.length : 0,
      conflicts:     conflicts
    };
  }

  // ── APPLY ──────────────────────────────────────────────────────────────────

  var createdCount  = 0;
  var skippedCount  = 0;
  var dataRowCount  = 0;
  var now           = new Date();
  var nowStr        = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // --- TAX_NUMBER_TYPES シート作成 + 初期データ登録 ---
  if (typesExists) {
    Logger.log('  ⏭️  ' + typesSheet + ' は既に存在するためスキップしました。');
    skippedCount++;
  } else {
    var typesNewSheet = ss.insertSheet(typesSheet);
    typesNewSheet.getRange(1, 1, 1, typesHeaders.length).setValues([typesHeaders]);
    Logger.log('  ✅ ' + typesSheet + ' を作成しました（ヘッダー ' + typesHeaders.length + '列）。');

    // 列インデックスを Registry から取得（1-indexed）
    var typeIdIdx      = typesHeaders.indexOf(typesTable.headers['TYPE_ID'])        + 1;
    var nameJaIdx      = typesHeaders.indexOf(typesTable.headers['NAME_JA'])        + 1;
    var nameEnIdx      = typesHeaders.indexOf(typesTable.headers['NAME_EN'])        + 1;
    var descIdx        = typesHeaders.indexOf(typesTable.headers['DESCRIPTION'])    + 1;
    var countryIdx     = typesHeaders.indexOf(typesTable.headers['TARGET_COUNTRY']) + 1;
    var activeIdx      = typesHeaders.indexOf(typesTable.headers['ACTIVE'])         + 1;
    var regAtIdx       = typesHeaders.indexOf(typesTable.headers['REGISTERED_AT'])  + 1;
    var updAtIdx       = typesHeaders.indexOf(typesTable.headers['UPDATED_AT'])     + 1;

    TAX_NUMBER_TYPE_INITIAL_DATA.forEach(function(row) {
      var targetRow = typesNewSheet.getLastRow() + 1;
      typesNewSheet.getRange(targetRow, typeIdIdx).setValue(row.typeId);
      typesNewSheet.getRange(targetRow, nameJaIdx).setValue(row.nameJa);
      typesNewSheet.getRange(targetRow, nameEnIdx).setValue(row.nameEn);
      typesNewSheet.getRange(targetRow, descIdx).setValue(row.description);
      typesNewSheet.getRange(targetRow, countryIdx).setValue(row.targetCountry);
      typesNewSheet.getRange(targetRow, activeIdx).setValue(true);
      typesNewSheet.getRange(targetRow, regAtIdx).setValue(nowStr);
      typesNewSheet.getRange(targetRow, updAtIdx).setValue(nowStr);
      Logger.log('  登録: ' + row.typeId + ' ' + row.nameJa);
    });

    dataRowCount = TAX_NUMBER_TYPE_INITIAL_DATA.length;
    createdCount++;
  }

  // --- CUSTOMER_TAX_NUMBERS シート作成（ヘッダーのみ）---
  if (ctnExists) {
    Logger.log('  ⏭️  ' + ctnSheet + ' は既に存在するためスキップしました。');
    skippedCount++;
  } else {
    var ctnNewSheet = ss.insertSheet(ctnSheet);
    ctnNewSheet.getRange(1, 1, 1, ctnHeaders.length).setValues([ctnHeaders]);
    Logger.log('  ✅ ' + ctnSheet + ' を作成しました（ヘッダー ' + ctnHeaders.length + '列）。');
    createdCount++;
  }

  Logger.log('');
  Logger.log('APPLY 完了。シート作成: ' + createdCount + '件 / スキップ: ' + skippedCount + '件 / データ登録: ' + dataRowCount + '件');

  return {
    mode:         'APPLY',
    createdCount:  createdCount,
    skippedCount:  skippedCount,
    dataRowCount:  dataRowCount,
    created:       (!typesExists ? [typesSheet] : []).concat(!ctnExists ? [ctnSheet] : []),
    skipped:       conflicts
  };
}
