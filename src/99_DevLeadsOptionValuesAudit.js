/**
 * DEV専用: リード管理シートの8列について、実データの値種類と件数を集計する。
 *
 * 書き込み系操作: なし
 * 返却値: JSON文字列（各列の distinct 値と出現回数、選択肢マスタ外の値を明示）
 *
 * 対象列（Registry 英語ヘッダー名 → 選択肢マスタの対応列）:
 *   response_speed      → 返信速度     col 8
 *   archive_reason      → アーカイブ理由 col 6
 *   deal_result         → 商談結果     col 14
 *   next_action_date    → 次回アクション日 col 28
 *   sales_channel       → 販売形態     col 16
 *   contact_method      → 連絡手段     col 9
 *   competitor_comparison → 競合比較中  col 17
 *   handled_title       → 取り扱い商材  col 10
 *
 * @returns {string} JSON.stringify({...})
 */
function devLeadsOptionValuesAudit() {
  if (getEnvironment() !== 'development') {
    throw new Error('devLeadsOptionValuesAudit は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));

  if (!sheet) {
    return JSON.stringify({ error: 'リード管理シートが見つかりません' });
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return JSON.stringify({ error: 'データ行なし', totalDataRows: 0 });
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var dataRows = lastRow - 1;

  // 対象列定義: headerKey → 対応する選択肢マスタ側の正しい値セット（PO決定: シートの値が正）
  var TARGET_COLUMNS = [
    {
      headerKey: 'response_speed',
      label: '返信速度（col 8）',
      validValues: ['即レス(30分以内)', '24h以内', '48h以内', '3日以上', '未返信']
    },
    {
      headerKey: 'archive_reason',
      label: 'アーカイブ理由（col 6）',
      validValues: ['未返信', '競合ネック', '価格ネック', '対象外', 'その他']
    },
    {
      headerKey: 'deal_result',
      label: '商談結果（col 14）',
      validValues: ['成約', '失注', '追客', '見送り', '対象外']
    },
    {
      headerKey: 'next_action_date',
      label: '次回アクション日（col 28）',
      validValues: ['相手の返信後', '不明点を確認後', '本日中', '明日までに', '3日以内', '1週間以内', '日付入力']
    },
    {
      headerKey: 'sales_channel',
      label: '販売形態（col 16）',
      validValues: ['実店舗', 'EC', 'ライブ配信', '卸売', '複合', 'その他']
    },
    {
      headerKey: 'contact_method',
      label: '連絡手段（col 9）',
      validValues: ['Whatsapp', 'Instagram', 'Facebook', 'Market Place', 'Telegram', 'メール', 'その他']
    },
    {
      headerKey: 'competitor_comparison',
      label: '競合比較中（col 17）',
      validValues: ['競合あり', '競合なし', '不明']
    },
    {
      headerKey: 'handled_title',
      label: '取り扱い商材（col 10）',
      validValues: ['Pokemon', 'One Piece', 'Yu-Gi-Oh', 'Dragon Ball', 'Weiss Schwarz', 'Union Arena']
    }
  ];

  var results = TARGET_COLUMNS.map(function(target) {
    var colIdx = headers.indexOf(target.headerKey);

    if (colIdx === -1) {
      return {
        headerKey: target.headerKey,
        label: target.label,
        found: false,
        colPosition: -1,
        totalDataRows: dataRows,
        emptyCount: null,
        nonEmptyCount: null,
        valueCounts: null,
        outsideValidSet: null
      };
    }

    // 値ごとの出現数を集計
    var countMap = {};
    var emptyCount = 0;

    for (var r = 1; r < allData.length; r++) {
      var raw = allData[r][colIdx];
      var val = (raw === null || raw === undefined) ? '' : String(raw).trim();

      if (val === '') {
        emptyCount++;
      } else {
        countMap[val] = (countMap[val] || 0) + 1;
      }
    }

    // 選択肢マスタ外の値を特定
    var validSet = target.validValues;
    var outsideValidSet = [];
    Object.keys(countMap).forEach(function(v) {
      if (validSet.indexOf(v) === -1) {
        outsideValidSet.push({ value: v, count: countMap[v] });
      }
    });

    // 出現順にソート（降順）
    var valueCounts = Object.keys(countMap).map(function(v) {
      return { value: v, count: countMap[v], inValidSet: validSet.indexOf(v) !== -1 };
    }).sort(function(a, b) { return b.count - a.count; });

    outsideValidSet.sort(function(a, b) { return b.count - a.count; });

    var nonEmptyCount = dataRows - emptyCount;

    return {
      headerKey: target.headerKey,
      label: target.label,
      found: true,
      colPosition: colIdx + 1,
      totalDataRows: dataRows,
      emptyCount: emptyCount,
      nonEmptyCount: nonEmptyCount,
      valueCounts: valueCounts,
      outsideValidSet: outsideValidSet,
      hasOutsideValues: outsideValidSet.length > 0
    };
  });

  return JSON.stringify({
    sheetName: sheet.getName(),
    auditedAt: new Date().toISOString(),
    totalDataRows: dataRows,
    note: 'validValues は 選択肢マスタ（シート正）の値。PO決定 2026-09-01。',
    columns: results
  });
}
