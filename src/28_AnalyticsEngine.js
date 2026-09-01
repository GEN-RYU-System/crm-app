
/**
 * 営業担当者の成約率を分析
 * @param {string} staffId - 担当者ID
 * @param {number} weeks - 過去何週間分を分析するか（デフォルト4週間）
 * @return {object} 分析結果
 */
function analyzeConversionRate(staffId, weeks = 4) {
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet) {
    throw new Error('リード管理シートが見つかりません');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeks * 7));

  // 該当期間のリードを取得
  const data = leadSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {
      staffId,
      period: `過去${weeks}週間`,
      totalLeads: 0,
      wonDeals: 0,
      lostDeals: 0,
      activeDeals: 0,
      conversionRate: 0,
      requiredLeadsPerDeal: 0,
      error: 'データがありません'
    };
  }

  const headers = data[0];

  const staffIdCol = headers.indexOf('assignee_id');
  const statusCol = headers.indexOf('進捗ステータス');
  const assignDateCol = headers.indexOf('assigned_at');

  if (staffIdCol === -1 || statusCol === -1 || assignDateCol === -1) {
    throw new Error('必要な列が見つかりません');
  }

  let totalLeads = 0;
  let wonDeals = 0;
  let lostDeals = 0;
  let activeDeals = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    if (row[staffIdCol] !== staffId) continue;

    const assignDate = new Date(row[assignDateCol]);
    if (isNaN(assignDate.getTime())) continue;
    if (assignDate < startDate || assignDate > endDate) continue;

    totalLeads++;

    const status = row[statusCol];
    if (status === '成約') wonDeals++;
    if (status === '失注') lostDeals++;
    if (status === '商談中' || status === '見積もり提示') activeDeals++;
  }

  const closedDeals = wonDeals + lostDeals;
  const conversionRate = closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;

  return {
    staffId,
    period: `過去${weeks}週間`,
    totalLeads,
    wonDeals,
    lostDeals,
    activeDeals,
    closedDeals,
    conversionRate: Math.round(conversionRate * 10) / 10,
    requiredLeadsPerDeal: conversionRate > 0 ? Math.ceil(100 / conversionRate) : 0
  };
}

/**
 * CSダッシュボード用: 必要リード数を計算
 * @param {string} staffId - 担当者ID
 * @param {number} targetDeals - 目標成約数
 * @return {object} アサイン推奨情報
 */
function calculateRequiredLeads(staffId, targetDeals) {
  const analysis = analyzeConversionRate(staffId);

  if (analysis.error) {
    return {
      staffId,
      targetDeals,
      error: analysis.error
    };
  }

  // 成約率が0%の場合は業界平均20%を仮定
  const assumedRate = analysis.conversionRate > 0 ? analysis.conversionRate : 20;
  const requiredLeads = Math.ceil((targetDeals * 100) / assumedRate);
  const buffer = Math.ceil(requiredLeads * 0.2); // 20%のバッファ
  const recommended = requiredLeads + buffer;

  return {
    staffId,
    targetDeals,
    conversionRate: analysis.conversionRate,
    assumedRate,
    requiredLeads,
    buffer,
    recommended,
    activeDeals: analysis.activeDeals,
    message: `目標${targetDeals}件成約のために、約${recommended}件のリードをアサイン推奨（成約率${assumedRate}%想定、バッファ${buffer}件含む）`
  };
}

/**
 * 全営業担当者の分析レポート生成
 * @return {array} 全営業担当者の分析結果
 */
function generateStaffAnalyticsReport() {
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet) {
    throw new Error('担当者マスタシートが見つかりません');
  }

  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdCol = headers.indexOf('assignee_id');
  const staffNameCol = headers.indexOf('担当者名');
  const roleCol = headers.indexOf('役職') !== -1 ? headers.indexOf('役職') : headers.indexOf('役割（権限）');

  const report = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const staffId = row[staffIdCol];
    const staffName = row[staffNameCol];
    const role = row[roleCol];

    // 営業担当のみ（役職に「営業」が含まれる）
    if (!role || !role.toString().includes('営業')) continue;

    const analysis = analyzeConversionRate(staffId);

    report.push({
      staffId,
      staffName,
      role,
      ...analysis
    });
  }

  return report;
}

/**
 * CSダッシュボード用: アサイン推奨情報を取得
 * @return {array} 全営業担当者のアサイン推奨情報
 */
function getAssignmentRecommendations() {
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet) {
    throw new Error('担当者マスタシートが見つかりません');
  }

  // KPI管理・PDSサイクルシートから目標を取得
  const kpiSheet = ss.getSheetByName('KPI管理・PDSサイクル');
  const kpiData = kpiSheet ? kpiSheet.getDataRange().getValues() : null;

  const staffData = staffSheet.getDataRange().getValues();
  const headers = staffData[0];

  const staffIdCol = headers.indexOf('assignee_id');
  const staffNameCol = headers.indexOf('担当者名');
  const roleCol = headers.indexOf('役職') !== -1 ? headers.indexOf('役職') : headers.indexOf('役割（権限）');

  const recommendations = [];

  for (let i = 1; i < staffData.length; i++) {
    const row = staffData[i];
    const staffId = row[staffIdCol];
    const staffName = row[staffNameCol];
    const role = row[roleCol];

    // 営業担当のみ
    if (!role || !role.toString().includes('営業')) continue;

    // KPIシートから今週の目標商談数を取得
    let targetDeals = 0;
    if (kpiData) {
      targetDeals = getTargetDealsFromKPI(staffId, kpiData);
    }

    // 目標がない場合はスキップ
    if (!targetDeals || targetDeals === 0) {
      recommendations.push({
        staffId,
        staffName,
        targetDeals: 0,
        message: '目標商談数が設定されていません'
      });
      continue;
    }

    // 必要リード数を計算
    const calc = calculateRequiredLeads(staffId, targetDeals);

    recommendations.push({
      staffId,
      staffName,
      role,
      ...calc
    });
  }

  return recommendations;
}

/**
 * KPIシートから目標商談数を取得（今週分）
 * @param {string} staffId - 担当者ID
 * @param {array} kpiData - KPIシートのデータ
 * @return {number} 目標商談数
 */
function getTargetDealsFromKPI(staffId, kpiData) {
  if (!kpiData || kpiData.length <= 1) return 0;

  const headers = kpiData[0];
  const staffIdCol = headers.indexOf('assignee_id');
  const periodTypeCol = headers.indexOf('期間種別');
  const targetDealsCol = headers.indexOf('目標商談数');
  const startDateCol = headers.indexOf('対象期間開始日');

  if (staffIdCol === -1 || targetDealsCol === -1) return 0;

  // 今週のデータを取得
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // 今週の日曜日

  for (let i = kpiData.length - 1; i >= 1; i--) { // 最新から検索
    const row = kpiData[i];

    if (row[staffIdCol] !== staffId) continue;
    if (periodTypeCol !== -1 && row[periodTypeCol] !== '週次') continue;

    const startDate = new Date(row[startDateCol]);
    if (isNaN(startDate.getTime())) continue;

    // 今週のデータかチェック
    if (startDate >= startOfWeek) {
      return row[targetDealsCol] || 0;
    }
  }

  return 0;
}

/**
 * テスト用: 特定営業担当の分析結果をログ出力
 * @param {string} staffId - 担当者ID
 */
function testAnalyzeStaff(staffId) {
  Logger.log('=== 営業担当分析 ===');
  Logger.log('担当者ID: ' + staffId);

  const analysis = analyzeConversionRate(staffId);
  Logger.log(JSON.stringify(analysis, null, 2));

  if (!analysis.error) {
    Logger.log('\n=== アサイン推奨（目標5件の場合） ===');
    const recommendation = calculateRequiredLeads(staffId, 5);
    Logger.log(JSON.stringify(recommendation, null, 2));
  }
}

/**
 * テスト用: 全営業担当の分析レポートをログ出力
 */
function testGenerateAllStaffReport() {
  Logger.log('=== 全営業担当分析レポート ===');
  const report = generateStaffAnalyticsReport();
  Logger.log(JSON.stringify(report, null, 2));
}
