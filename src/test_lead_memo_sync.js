/**
 * リード管理の商談メモ同期テスト
 */

/**
 * リード管理シートのヘッダー配列から列インデックスを取得する。
 * 新名（英語スネークケース）で検索し、見つからなければ旧名（日本語）でフォールバックする。
 * PR-1（デュアルサポート期）専用。PR-3 で削除する。
 */
function _leadsHeaderIdx(headers, newName, oldName) {
  var idx = headers.indexOf(newName);
  return idx !== -1 ? idx : headers.indexOf(oldName);
}

function testLeadMemoSync() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  Logger.log('='.repeat(80));
  Logger.log('リード管理 商談メモ同期テスト');
  Logger.log('='.repeat(80));
  Logger.log('');

  // 1. ヘッダー確認
  Logger.log('【Step 1: ヘッダー確認】');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const memoIndex = _leadsHeaderIdx(headers, 'deal_note', '商談メモ');

  Logger.log('ヘッダー数: ' + headers.length);
  Logger.log('商談メモ列番号: ' + (memoIndex + 1) + ' (0-indexed: ' + memoIndex + ')');

  if (memoIndex === -1) {
    Logger.log('❌ 商談メモ列が見つかりません！');
    return {
      success: false,
      error: '商談メモ列が見つかりません'
    };
  }
  Logger.log('✅ 商談メモ列は存在します');
  Logger.log('');

  // 2. サンプルデータ確認（最新3件）
  Logger.log('【Step 2: スプレッドシートの実際のデータ（最新3件）】');
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    Logger.log('⚠️ データがありません');
    return { success: false, error: 'データなし' };
  }

  const sampleSize = Math.min(3, lastRow - 1);
  const startRow = lastRow - sampleSize + 1;
  const dataRange = sheet.getRange(startRow, 1, sampleSize, headers.length).getValues();

  dataRange.forEach((row, index) => {
    const actualRow = startRow + index;
    const leadId = row[_leadsHeaderIdx(headers, 'lead_id', 'リードID')];
    const customerName = row[headers.indexOf('顧客名')];
    const memoValue = row[memoIndex];

    Logger.log(`行${actualRow}:`);
    Logger.log(`  リードID: ${leadId}`);
    Logger.log(`  顧客名: ${customerName}`);
    Logger.log(`  商談メモ: ${memoValue === '' ? '(空)' : memoValue}`);
    Logger.log('');
  });

  // 3. getLeads() 関数の返り値確認
  Logger.log('【Step 3: getLeads() 関数の返り値確認】');

  const leads = getLeads('lead', null);  // すべてのリード
  Logger.log('取得したリード数: ' + leads.length);

  if (leads.length === 0) {
    Logger.log('⚠️ リードが取得できませんでした');
    return { success: false, error: 'リードが取得できない' };
  }

  // 最初の3件を確認
  const testLeads = leads.slice(0, Math.min(3, leads.length));

  testLeads.forEach((lead, index) => {
    Logger.log(`Lead ${index + 1}:`);
    Logger.log(`  リードID: ${lead['リードID']}`);
    Logger.log(`  顧客名: ${lead['顧客名']}`);

    // 商談メモの存在確認
    if ('商談メモ' in lead) {
      Logger.log(`  ✅ 商談メモキー: 存在する`);
      Logger.log(`  商談メモ値: ${lead['商談メモ'] === '' ? '(空)' : lead['商談メモ']}`);
    } else {
      Logger.log(`  ❌ 商談メモキー: 存在しない`);
    }

    // すべてのキーを確認（商談関連のキーのみ）
    const dealKeys = Object.keys(lead).filter(key => key.includes('商談') || key.includes('メモ'));
    if (dealKeys.length > 0) {
      Logger.log(`  関連キー: ${dealKeys.join(', ')}`);
    }

    Logger.log('');
  });

  // 4. 特定のリードで詳細テスト（最初のリード）
  if (leads.length > 0) {
    const testLead = leads[0];
    const testLeadId = testLead['リードID'];

    Logger.log('【Step 4: 特定リードの詳細テスト】');
    Logger.log('テストリードID: ' + testLeadId);
    Logger.log('');

    // getLeadDetail() を呼び出し
    const leadDetail = getLeadDetail(testLeadId);

    if (leadDetail) {
      Logger.log('getLeadDetail() 結果:');
      Logger.log(`  リードID: ${leadDetail['リードID']}`);
      Logger.log(`  顧客名: ${leadDetail['顧客名']}`);

      if ('商談メモ' in leadDetail) {
        Logger.log(`  ✅ 商談メモ: 存在する`);
        Logger.log(`  値: ${leadDetail['商談メモ'] === '' ? '(空)' : leadDetail['商談メモ']}`);
      } else {
        Logger.log(`  ❌ 商談メモ: 存在しない`);
      }
    } else {
      Logger.log('❌ getLeadDetail() が null を返しました');
    }

    Logger.log('');
  }

  // 5. updateLead() のテスト（書き込みせずに確認のみ）
  Logger.log('【Step 5: ヘッダーマッピング確認】');
  Logger.log('商談メモのヘッダー位置: ' + (memoIndex + 1) + '列目');
  Logger.log('HEADERS.LEADSでの位置: ' + (HEADERS._leadsHeaderIdx(LEADS, 'deal_note', '商談メモ') + 1) + '列目');

  const configIndex = HEADERS._leadsHeaderIdx(LEADS, 'deal_note', '商談メモ');
  if (configIndex === memoIndex) {
    Logger.log('✅ 一致: HEADERSとシートで列位置が一致');
  } else {
    Logger.log('❌ 不一致: HEADERSとシートで列位置がずれています！');
    Logger.log(`   HEADERS: ${configIndex + 1}列目`);
    Logger.log(`   シート: ${memoIndex + 1}列目`);
  }

  Logger.log('');
  Logger.log('='.repeat(80));
  Logger.log('テスト完了');
  Logger.log('='.repeat(80));

  return {
    success: true,
    headerIndex: memoIndex + 1,
    configIndex: configIndex + 1,
    match: configIndex === memoIndex,
    testLeadCount: leads.length
  };
}

/**
 * 特定リードの商談メモを更新してテスト
 */
function testUpdateLeadMemo(leadId, newMemoValue) {
  Logger.log('='.repeat(80));
  Logger.log('商談メモ更新テスト');
  Logger.log('='.repeat(80));
  Logger.log('リードID: ' + leadId);
  Logger.log('新しい値: ' + newMemoValue);
  Logger.log('');

  // 更新前の値を取得
  const beforeLead = getLeadDetail(leadId);
  if (!beforeLead) {
    Logger.log('❌ リードが見つかりません');
    return { success: false, error: 'リードが見つかりません' };
  }

  Logger.log('【更新前】');
  Logger.log('商談メモ: ' + (beforeLead['商談メモ'] || '(空)'));
  Logger.log('');

  // 更新実行
  try {
    updateLead('リード管理', leadId, { '商談メモ': newMemoValue });
    Logger.log('✅ updateLead() 実行完了');
  } catch (e) {
    Logger.log('❌ updateLead() エラー: ' + e.message);
    return { success: false, error: e.message };
  }

  // 更新後の値を取得
  Utilities.sleep(1000);  // 1秒待機
  const afterLead = getLeadDetail(leadId);

  Logger.log('');
  Logger.log('【更新後】');
  Logger.log('商談メモ: ' + (afterLead['商談メモ'] || '(空)'));
  Logger.log('');

  // 検証
  if (afterLead['商談メモ'] === newMemoValue) {
    Logger.log('✅ 正しく更新されました');
    return { success: true };
  } else {
    Logger.log('❌ 更新が反映されていません');
    Logger.log('期待値: ' + newMemoValue);
    Logger.log('実際の値: ' + afterLead['商談メモ']);
    return { success: false, error: '更新が反映されない' };
  }
}
