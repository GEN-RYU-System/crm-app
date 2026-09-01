/**
 * DEV専用: 選択肢マスタV2 に 13 category / 67値 を投入する。
 *
 * 書き込み系操作: 選択肢マスタV2 への setValues のみ（既存行・他シートに触れない）
 * 冪等性: dry-run を先に実行し件数を確認してから実行すること
 *
 * 実行方法:
 *   clasp run devSeedOptionMasterV2DryRun   → 投入予定行を報告（書き込みなし）
 *   clasp run devSeedOptionMasterV2Execute  → 実投入（シートが空の場合のみ）
 *
 * PO決定（2026-09-02）:
 *   - 値が不一致の8件はシート側の値を正とする
 *   - contact_method は 8種確定（Discord追加・LINE除外・メール採用）
 *   - category名は column-rename-plan.md §3-8 の変換案を使用
 */

var OPTION_MASTER_V2_SEED_DATA = (function() {
  var categories = [
    {
      category: 'lead_type',
      values: ['インバウンド', 'アウトバウンド']
    },
    {
      category: 'response_speed',
      values: ['即レス(30分以内)', '24h以内', '48h以内', '3日以上', '未返信']
    },
    {
      category: 'archive_reason',
      values: ['未返信', '競合ネック', '価格ネック', '対象外', 'その他']
    },
    {
      category: 'lead_status',
      values: ['新規リード', 'リード対応中', 'アサイン確定', 'リード対象外', '商談中', '商談対象外', '追客(短期)', '追客(長期)', '成約', '失注']
    },
    {
      category: 'contact_method',
      values: ['Whatsapp', 'Instagram', 'Facebook', 'Market Place', 'Telegram', 'メール', 'Discord', 'その他']
    },
    {
      category: 'handled_merchandise',
      values: ['Pokemon', 'One Piece', 'Yu-Gi-Oh', 'Dragon Ball', 'Weiss Schwarz', 'Union Arena']
    },
    {
      category: 'lead_temperature',
      values: ['高', '中', '低']
    },
    {
      category: 'expected_scale',
      values: ['大口', '中規模', '小口', '不明']
    },
    {
      category: 'deal_result',
      values: ['成約', '失注', '追客', '見送り', '対象外']
    },
    {
      category: 'customer_type',
      values: ['信頼重視', '価格重視', '不明']
    },
    {
      category: 'sales_channel',
      values: ['実店舗', 'EC', 'ライブ配信', '卸売', '複合', 'その他']
    },
    {
      category: 'competitor_comparison',
      values: ['競合あり', '競合なし', '不明']
    },
    {
      category: 'next_action_date',
      values: ['相手の返信後', '不明点を確認後', '本日中', '明日までに', '3日以内', '1週間以内', '日付入力']
    }
  ];

  var rows = [];
  var seq = 1;
  categories.forEach(function(cat) {
    cat.values.forEach(function(val, idx) {
      var optionId = 'OPT-' + String(seq).padStart(5, '0');
      rows.push([optionId, cat.category, val, idx + 1, true]);
      seq++;
    });
  });
  return rows;
})();

/**
 * dry-run: 投入予定の行を JSON で報告する（書き込みなし）
 * @returns {string} JSON.stringify({ totalRows, categoryCounts, rows })
 */
function devSeedOptionMasterV2DryRun() {
  if (getEnvironment() !== 'development') {
    throw new Error('devSeedOptionMasterV2DryRun は DEV 環境でのみ実行できます');
  }

  var categoryCounts = {};
  OPTION_MASTER_V2_SEED_DATA.forEach(function(row) {
    var cat = row[1];
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  return JSON.stringify({
    totalRows: OPTION_MASTER_V2_SEED_DATA.length,
    totalCategories: Object.keys(categoryCounts).length,
    categoryCounts: categoryCounts,
    rows: OPTION_MASTER_V2_SEED_DATA.map(function(row) {
      return { option_id: row[0], category: row[1], value: row[2], sort_order: row[3], is_active: row[4] };
    })
  });
}

/**
 * 実投入: 選択肢マスタV2 にデータを投入する。
 * シートにデータ行が既にある場合は中止する（冪等保護）。
 * @returns {string} JSON.stringify({ inserted, duplicateCheck, categoryCountCheck })
 */
function devSeedOptionMasterV2Execute() {
  if (getEnvironment() !== 'development') {
    throw new Error('devSeedOptionMasterV2Execute は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('OPTION_MASTER'));
  if (!sheet) {
    return JSON.stringify({ error: '選択肢マスタV2 シートが見つかりません' });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    return JSON.stringify({
      error: 'シートに既存データがあります（データ行: ' + (lastRow - 1) + '）。重複投入を防ぐため中止します。'
    });
  }

  // 一括投入
  var data = OPTION_MASTER_V2_SEED_DATA;
  sheet.getRange(2, 1, data.length, 5).setValues(data);

  // 検証1: 行数確認
  var actualRows = sheet.getLastRow() - 1;

  // 検証2: option_id 重複確認
  var ids = data.map(function(row) { return row[0]; });
  var idSet = {};
  var idDuplicates = [];
  ids.forEach(function(id) {
    if (idSet[id]) { idDuplicates.push(id); }
    idSet[id] = true;
  });

  // 検証3: (category, value) 重複確認
  var pairSet = {};
  var pairDuplicates = [];
  data.forEach(function(row) {
    var key = row[1] + '::' + row[2];
    if (pairSet[key]) { pairDuplicates.push(key); }
    pairSet[key] = true;
  });

  // 検証4: category ごとの件数
  var categoryCounts = {};
  data.forEach(function(row) {
    var cat = row[1];
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  return JSON.stringify({
    inserted: actualRows,
    expectedRows: data.length,
    rowCountMatch: actualRows === data.length,
    idDuplicates: idDuplicates,
    pairDuplicates: pairDuplicates,
    categoryCounts: categoryCounts,
    ok: actualRows === data.length && idDuplicates.length === 0 && pairDuplicates.length === 0
  });
}
