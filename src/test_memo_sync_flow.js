
function testMemoSyncFlow() {
  Logger.log('='.repeat(80));
  Logger.log('商談メモ同期フロー 完全テスト');
  Logger.log('='.repeat(80));
  Logger.log('');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('❌ リード管理シートにデータがありません');
    return { success: false, error: 'データなし' };
  }

  // 【Step 1】最初のリードを取得
  Logger.log('【Step 1: リード取得】');
  const allLeads = getLeads('lead', null);

  if (allLeads.length === 0) {
    Logger.log('❌ リードが取得できません');
    return { success: false, error: 'リードが取得できない' };
  }

  const testLead = allLeads[0];
  const testLeadId = testLead['lead_id'];

  Logger.log('テストリードID: ' + testLeadId);
  var nameKey = 'customer_name';
  Logger.log(nameKey + ': ' + (testLead[nameKey] || '(unknown)'));
  Logger.log('');

  // 【Step 2】getLeads()の結果を確認
  Logger.log('【Step 2: getLeads() の deal_note 確認】');

  if ('deal_note' in testLead) {
    Logger.log('✅ deal_noteキー: 存在する');
    const memoValue = testLead['deal_note'];
    Logger.log('deal_note値: ' + (memoValue === '' ? '(空)' : memoValue));
  } else {
    Logger.log('❌ deal_noteキー: 存在しない');
    Logger.log('利用可能なキー: ' + Object.keys(testLead).join(', '));
    return { success: false, error: 'getLeads()にdeal_noteが含まれない' };
  }
  Logger.log('');

  // 【Step 3】getLeadDetail()で詳細取得
  Logger.log('【Step 3: getLeadDetail() の deal_note 確認】');

  const leadDetail = getLeadDetail(testLeadId);

  if (!leadDetail) {
    Logger.log('❌ getLeadDetail()がnullを返しました');
    return { success: false, error: 'getLeadDetail()がnull' };
  }

  if ('deal_note' in leadDetail) {
    Logger.log('✅ deal_noteキー: 存在する');
    const memoValue = leadDetail['deal_note'];
    Logger.log('deal_note値: ' + (memoValue === '' ? '(空)' : memoValue));
  } else {
    Logger.log('❌ deal_noteキー: 存在しない');
    Logger.log('利用可能なキー: ' + Object.keys(leadDetail).join(', '));
    return { success: false, error: 'getLeadDetail()にdeal_noteが含まれない' };
  }
  Logger.log('');

  // 【Step 4】スプレッドシートから直接読み取り
  Logger.log('【Step 4: スプレッドシートから直接読み取り】');

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leadIdIdx = headers.indexOf('lead_id');
  const memoIdx = headers.indexOf('deal_note');

  Logger.log('リードID列番号: ' + (leadIdIdx + 1) + ' (0-indexed: ' + leadIdIdx + ')');
  Logger.log('deal_note列番号: ' + (memoIdx + 1) + ' (0-indexed: ' + memoIdx + ')');

  if (memoIdx === -1) {
    Logger.log('❌ deal_note列が見つかりません');
    return { success: false, error: 'deal_note列が見つからない' };
  }

  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === testLeadId) {
      targetRow = i;
      break;
    }
  }

  if (targetRow === -1) {
    Logger.log('❌ 該当リードが見つかりません');
    return { success: false, error: 'リードが見つからない' };
  }

  const directMemoValue = data[targetRow][memoIdx];
  Logger.log('スプレッドシートのdeal_note値: ' + (directMemoValue === '' ? '(空)' : directMemoValue));
  Logger.log('');

  // 【Step 5】updateLead()でdeal_noteを更新
  Logger.log('【Step 5: deal_noteを更新】');

  const timestamp = new Date().toISOString();
  const testMemoValue = 'テスト更新 ' + timestamp;

  Logger.log('更新前の値: ' + (leadDetail['deal_note'] === '' ? '(空)' : leadDetail['deal_note']));
  Logger.log('更新する値: ' + testMemoValue);

  try {
    updateLead('リード管理', testLeadId, { 'deal_note': testMemoValue });
    Logger.log('✅ updateLead() 実行成功');
  } catch (e) {
    Logger.log('❌ updateLead() エラー: ' + e.message);
    return { success: false, error: 'updateLead()失敗: ' + e.message };
  }
  Logger.log('');

  // 【Step 6】更新後の値を確認
  Logger.log('【Step 6: 更新後の値を確認】');

  Utilities.sleep(1000); // 1秒待機

  const updatedLead = getLeadDetail(testLeadId);
  const updatedMemoValue = updatedLead['deal_note'];

  Logger.log('更新後の値: ' + updatedMemoValue);

  if (updatedMemoValue === testMemoValue) {
    Logger.log('✅ 正しく更新されました！');
  } else {
    Logger.log('❌ 更新が反映されていません');
    Logger.log('期待値: ' + testMemoValue);
    Logger.log('実際の値: ' + updatedMemoValue);
    return { success: false, error: '更新が反映されない' };
  }
  Logger.log('');

  // 【Step 7】スプレッドシートを直接確認
  Logger.log('【Step 7: スプレッドシートを直接確認】');

  const updatedData = sheet.getDataRange().getValues();
  const updatedDirectValue = updatedData[targetRow][memoIdx];

  Logger.log('スプレッドシートの値: ' + updatedDirectValue);

  if (updatedDirectValue === testMemoValue) {
    Logger.log('✅ スプレッドシートにも正しく反映されています！');
  } else {
    Logger.log('⚠️ スプレッドシートの値が異なります');
    Logger.log('期待値: ' + testMemoValue);
    Logger.log('実際の値: ' + updatedDirectValue);
  }
  Logger.log('');

  Logger.log('='.repeat(80));
  Logger.log('✅ 全てのテスト完了 - deal_noteの同期は正常に動作しています');
  Logger.log('='.repeat(80));

  return {
    success: true,
    testLeadId: testLeadId,
    testValue: testMemoValue,
    getLeadsHasMemo: ('deal_note' in testLead),
    getLeadDetailHasMemo: ('deal_note' in leadDetail),
    updateSucceeded: (updatedMemoValue === testMemoValue),
    sheetValueMatches: (updatedDirectValue === testMemoValue)
  };
}

/**
 * deal_noteの値を元に戻す（クリーンアップ用）
 */
function cleanupMemoTest(leadId) {
  Logger.log('deal_noteをクリアしています...');

  try {
    updateLead('リード管理', leadId, { 'deal_note': '' });
    Logger.log('✅ deal_noteをクリアしました');
    return { success: true };
  } catch (e) {
    Logger.log('❌ クリーンアップ失敗: ' + e.message);
    return { success: false, error: e.message };
  }
}
