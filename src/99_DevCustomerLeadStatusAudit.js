/**
 * DEV専用: 顧客一覧 API の戻り値を sessionId なしで検証する。
 *
 * 書き込み系操作: なし
 * 返却値: JSON文字列
 *   - customers: 全顧客行（customerId / customerName / country / salesAssigneeId）
 *   - totalRows: 件数
 *   - salesAssigneeIdValues: 重複排除した salesAssigneeId 一覧
 *
 * 目的: PR #986 の修正検証（CORE_SCHEMA_HEADER_KEY_NOT_FOUND 解消 + salesAssigneeId 返却確認）
 *
 * @returns {string} JSON.stringify(result)
 */
function devCustomerListAudit() {
  if (getEnvironment() !== 'development') {
    throw new Error('devCustomerListAudit は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();

  // buildCoreCustomerListRows_ と同じキーセットで読み取る
  var customers = coreCustomerFrontendReadTable(ss, 'CUSTOMERS', [
    'CUSTOMER_ID', 'SOURCE_LEAD_ID', 'CUSTOMER_NAME', 'COUNTRY', 'SALES_ASSIGNEE_ID'
  ]);

  var rows = customers.rows.map(function(row) {
    return {
      customerId:      String(row[customers.indexes.CUSTOMER_ID]  || '').trim(),
      customerName:    String(row[customers.indexes.CUSTOMER_NAME] || '').trim(),
      country:         String(row[customers.indexes.COUNTRY]       || '').trim(),
      salesAssigneeId: String(row[customers.indexes.SALES_ASSIGNEE_ID] || '').trim()
    };
  });

  var idSet = {};
  rows.forEach(function(r) {
    if (r.salesAssigneeId) idSet[r.salesAssigneeId] = true;
  });

  return JSON.stringify({
    auditedAt: new Date().toISOString(),
    totalRows: rows.length,
    salesAssigneeIdValues: Object.keys(idSet).sort(),
    customers: rows
  });
}

/**
 * DEV専用: LEADS シートの lead_status 列の全行値を取得し、
 * CONFIG.LEAD_STATUSES との一致件数を報告する。
 *
 * 書き込み系操作: なし
 * 返却値: JSON文字列
 *   - totalDataRows: データ行数
 *   - leadStatuses: CONFIG.LEAD_STATUSES の定義値
 *   - valueCounts: 実データの値ごとの出現数
 *   - matchCount: CONFIG.LEAD_STATUSES に一致する行数
 *   - noMatchCount: 一致しない行数（getLeads でフィルタ除外される行数）
 *
 * @returns {string} JSON.stringify(result)
 */
function devLeadStatusAllRows() {
  if (getEnvironment() !== 'development') {
    throw new Error('devLeadStatusAllRows は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(getCoreSchemaV1TableName('LEADS'));

  if (!sheet) {
    return JSON.stringify({ error: 'リード管理シートが見つかりません' });
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return JSON.stringify({ error: 'データ行なし', totalDataRows: 0 });
  }

  var headers = allData[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var statusColIdx = headers.indexOf('lead_status');

  if (statusColIdx === -1) {
    return JSON.stringify({ error: 'lead_status 列が見つかりません', headers: headers });
  }

  var dataRows = allData.length - 1;
  var configStatuses = CONFIG.LEAD_STATUSES;

  // 実データ全行の lead_status 値を収集
  var rawValues = [];
  var countMap = {};

  for (var r = 1; r < allData.length; r++) {
    var raw = allData[r][statusColIdx];
    var val = (raw === null || raw === undefined) ? '' : String(raw).trim();
    rawValues.push(val);
    countMap[val] = (countMap[val] || 0) + 1;
  }

  // CONFIG.LEAD_STATUSES との照合
  var matchCount = 0;
  var noMatchCount = 0;
  rawValues.forEach(function(v) {
    if (configStatuses.indexOf(v) !== -1) {
      matchCount++;
    } else {
      noMatchCount++;
    }
  });

  // 出現数降順ソート
  var valueCounts = Object.keys(countMap).map(function(v) {
    return {
      value: v || '(空)',
      count: countMap[v],
      inLeadStatuses: configStatuses.indexOf(v) !== -1
    };
  }).sort(function(a, b) { return b.count - a.count; });

  return JSON.stringify({
    auditedAt:    new Date().toISOString(),
    sheetName:    sheet.getName(),
    totalDataRows: dataRows,
    statusColPosition: statusColIdx + 1,
    leadStatuses: configStatuses,
    valueCounts:  valueCounts,
    matchCount:   matchCount,
    noMatchCount: noMatchCount,
    allRawValues: rawValues
  });
}
