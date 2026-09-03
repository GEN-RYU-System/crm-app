/**
 * DEV専用: lead_status の値不整合を調査する。
 *
 * 書き込み系操作: なし
 *
 * 確認項目:
 *   1. 選択肢マスタV2 の lead_status カテゴリの全値
 *   2. CONFIG.LEAD_STATUSES の実行時値（静的定数）
 *   3. LEADS シートの lead_status 実データ値（参考：devLeadStatusAllRows の結果を再掲）
 *   4. CONFIG.LEAD_STATUSES の出所（設定シートか静的定数か）
 *
 * @returns {string} JSON.stringify(result)
 */
function devLeadStatusInvestigation() {
  if (getEnvironment() !== 'development') {
    throw new Error('devLeadStatusInvestigation は DEV 環境でのみ実行できます');
  }

  // ── 1. 選択肢マスタV2 の全カテゴリを取得 ──
  var allOptions = getAllOptionsGroupedFromV2_();
  var optionMasterV2Categories = Object.keys(allOptions).sort();

  // lead_status カテゴリを探す（カテゴリ名は不明のため全パターン検索）
  var leadStatusCandidates = {};
  optionMasterV2Categories.forEach(function(cat) {
    var lcat = cat.toLowerCase();
    if (lcat.indexOf('lead') !== -1 || lcat.indexOf('status') !== -1 || lcat.indexOf('ステータス') !== -1) {
      leadStatusCandidates[cat] = allOptions[cat];
    }
  });

  // ── 2. CONFIG.LEAD_STATUSES の実行時値 ──
  var configLeadStatuses = CONFIG.LEAD_STATUSES;

  // ── 3. LEADS シートの lead_status 実データ ──
  var ss = getSpreadsheet();
  var leadsSheet = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));
  var leadsData = { error: null, statusColPosition: -1, valueCounts: [], totalDataRows: 0, matchCountVsConfig: 0 };

  if (!leadsSheet) {
    leadsData.error = 'リード管理シートが見つかりません';
  } else {
    var allData = leadsSheet.getDataRange().getValues();
    var headers = allData[0].map(function(h) { return String(h != null ? h : '').trim(); });
    var statusColIdx = headers.indexOf('lead_status');
    leadsData.statusColPosition = statusColIdx + 1;
    leadsData.totalDataRows = allData.length - 1;

    if (statusColIdx !== -1) {
      var countMap = {};
      for (var r = 1; r < allData.length; r++) {
        var raw = allData[r][statusColIdx];
        var val = (raw === null || raw === undefined) ? '' : String(raw).trim();
        countMap[val] = (countMap[val] || 0) + 1;
        if (configLeadStatuses.indexOf(val) !== -1) leadsData.matchCountVsConfig++;
      }
      leadsData.valueCounts = Object.keys(countMap).map(function(v) {
        return {
          value: v || '(空)',
          count: countMap[v],
          inConfigLeadStatuses: configLeadStatuses.indexOf(v) !== -1,
          inOptionMasterV2LeadStatus: leadStatusCandidates['lead_status']
            ? leadStatusCandidates['lead_status'].indexOf(v) !== -1
            : null
        };
      }).sort(function(a, b) { return b.count - a.count; });
    } else {
      leadsData.error = 'lead_status 列が見つかりません';
    }
  }

  // ── 4. 設定シート（選択肢マスタ旧）の存在確認 ──
  var settingsSheetName = CONFIG.SHEETS.SETTINGS;
  var settingsSheet = ss.getSheetByName(settingsSheetName);
  var settingsSheetExists = !!settingsSheet;

  // ── 5. CONFIG.LEAD_STATUSES が設定シート由来か静的定数か ──
  // getStatusSettingsFromSheet() は SETTINGS シートがなければ DEFAULT_STATUS_SETTINGS を返す
  // DEFAULT_STATUS_SETTINGS.LEAD_STATUSES = ['新規', '対応中', '対象外']（values のみ）
  // CONFIG.LEAD_STATUSES（静的）= ['新規リード', 'リード対応中', 'リード対象外']
  // → この2つは別の定義
  var configSource = settingsSheetExists ? 'CONFIG.SHEETS.SETTINGS（選択肢マスタ）から動的取得の可能性あり' : 'CONFIG.SHEETS.SETTINGS シートが存在しないため、静的定数 src/08_Config.js:154 を使用';

  return JSON.stringify({
    auditedAt: new Date().toISOString(),
    // 1. 選択肢マスタV2
    optionMasterV2: {
      sheetName: getCoreSchemaV1TableName('OPTION_MASTER'),
      totalCategories: optionMasterV2Categories.length,
      allCategories: optionMasterV2Categories,
      leadStatusRelatedCategories: leadStatusCandidates
    },
    // 2. CONFIG.LEAD_STATUSES（実行時）
    configLeadStatuses: {
      value: configLeadStatuses,
      count: configLeadStatuses.length,
      source: 'src/08_Config.js:154（静的定数）',
      settingsSheetName: settingsSheetName,
      settingsSheetExists: settingsSheetExists,
      runtimeNote: configSource
    },
    // 3. LEADS 実データ
    leadsActualData: leadsData,
    // 照合サマリ
    comparisonSummary: {
      leadsVsConfigLeadStatuses: leadsData.matchCountVsConfig + '/' + leadsData.totalDataRows + ' 行が一致',
      optionMasterV2HasLeadStatusCategory: !!leadStatusCandidates['lead_status'],
      leadStatusCategoryValues: leadStatusCandidates['lead_status'] || null
    }
  });
}
