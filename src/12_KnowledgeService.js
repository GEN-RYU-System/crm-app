/**
 * 商材ナレッジ管理サービス
 * gid & ヘッダー名ベースで実装（列の順序変更に強い）
 */

/**
 * ナレッジ全件取得
 */
function getKnowledgeList() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.TERM_DICTIONARY);
    if (!sheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.TERM_DICTIONARY);

    // ヘッダー行からインデックスマップを作成
    const headerMap = getHeaderIndexMap(sheet);

    // データ範囲を取得
    const data = sheet.getDataRange().getValues();

    // 列インデックスを取得
    const idIdx = headerMap[TERM_DICTIONARY_HEADERS.ID];
    const categoryIdx = headerMap[TERM_DICTIONARY_HEADERS.CATEGORY];
    const englishIdx = headerMap[TERM_DICTIONARY_HEADERS.ENGLISH];
    const japaneseIdx = headerMap[TERM_DICTIONARY_HEADERS.JAPANESE];
    const meaningIdx = headerMap[TERM_DICTIONARY_HEADERS.MEANING];
    const activeIdx = headerMap[TERM_DICTIONARY_HEADERS.ACTIVE];

    // データをマッピング（ヘッダー行を除く）
    return data.slice(1)
      .filter(row => row[idIdx]) // IDが空でない行のみ
      .map(row => ({
        id: row[idIdx],
        category: row[categoryIdx] || '',
        english: row[englishIdx] || '',
        japanese: row[japaneseIdx] || '',
        meaning: row[meaningIdx] || '',
        active: row[activeIdx] === true || row[activeIdx] === 'TRUE'
      }));
  } catch (e) {
    Logger.log('❌ getKnowledgeList エラー: ' + e.message);
    return [];
  }
}

/**
 * ナレッジ保存（新規作成 or 更新）
 */
function saveKnowledge(formData) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.TERM_DICTIONARY);
    if (!sheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.TERM_DICTIONARY);

    const headerMap = getHeaderIndexMap(sheet);
    const data = sheet.getDataRange().getValues();

    // 列インデックスを取得
    const idIdx = headerMap[TERM_DICTIONARY_HEADERS.ID];
    const categoryIdx = headerMap[TERM_DICTIONARY_HEADERS.CATEGORY];
    const englishIdx = headerMap[TERM_DICTIONARY_HEADERS.ENGLISH];
    const japaneseIdx = headerMap[TERM_DICTIONARY_HEADERS.JAPANESE];
    const meaningIdx = headerMap[TERM_DICTIONARY_HEADERS.MEANING];
    const activeIdx = headerMap[TERM_DICTIONARY_HEADERS.ACTIVE];
    const createdDateIdx = headerMap[TERM_DICTIONARY_HEADERS.CREATED_DATE];
    const updatedDateIdx = headerMap[TERM_DICTIONARY_HEADERS.UPDATED_DATE];
    const createdByIdx = headerMap[TERM_DICTIONARY_HEADERS.CREATED_BY];
    const updatedByIdx = headerMap[TERM_DICTIONARY_HEADERS.UPDATED_BY];

    const now = new Date();
    let currentUser = '';
    try {
      const email = resolveCurrentUserEmail();
      Logger.log('saveKnowledge currentUser email: ' + email);
      Logger.log('saveKnowledge updatedByIdx: ' + updatedByIdx);
      currentUser = email ? (getStaffNameByEmail_(email) || email) : 'unknown';
      Logger.log('saveKnowledge currentUser name: ' + currentUser);
    } catch (e) {
      Logger.log('saveKnowledge currentUser取得エラー: ' + e.message);
      currentUser = '';
    }

    if (!formData.id) {
      // --- 新規作成 ---
      const newId = generateNextKnowledgeId(sheet, headerMap);

      // 新しい行データを作成（列数分の配列）
      const lastColIndex = sheet.getLastColumn();
      const newRow = new Array(lastColIndex).fill('');

      // マップに従って値を埋める
      newRow[idIdx] = newId;
      newRow[categoryIdx] = formData.category || '';
      newRow[englishIdx] = formData.english || '';
      newRow[japaneseIdx] = formData.japanese || '';
      newRow[meaningIdx] = formData.meaning || '';
      newRow[activeIdx] = formData.active === true || formData.active === 'true';
      if (createdDateIdx !== undefined) newRow[createdDateIdx] = now;
      if (createdByIdx !== undefined) newRow[createdByIdx] = currentUser;

      sheet.appendRow(newRow);

      Logger.log('✅ 新規ナレッジ作成: ' + newId);
      return { success: true, message: '新規作成しました', id: newId };

    } else {
      // --- 更新 ---
      const rowIndex = data.findIndex(row => row[idIdx] === formData.id);

      if (rowIndex === -1) {
        return { success: false, error: '指定されたIDが見つかりません' };
      }

      const rowNum = rowIndex + 1; // 1-based index

      // 特定のセルだけ更新（+1 は 1-based index変換）
      sheet.getRange(rowNum, categoryIdx + 1).setValue(formData.category || '');
      sheet.getRange(rowNum, englishIdx + 1).setValue(formData.english || '');
      sheet.getRange(rowNum, japaneseIdx + 1).setValue(formData.japanese || '');
      sheet.getRange(rowNum, meaningIdx + 1).setValue(formData.meaning || '');
      sheet.getRange(rowNum, activeIdx + 1).setValue(formData.active === true || formData.active === 'true');
      if (updatedDateIdx !== undefined) sheet.getRange(rowNum, updatedDateIdx + 1).setValue(now);
      if (updatedByIdx !== undefined) sheet.getRange(rowNum, updatedByIdx + 1).setValue(currentUser);

      Logger.log('✅ ナレッジ更新: ' + formData.id);
      return { success: true, message: '更新しました', id: formData.id };
    }
  } catch (e) {
    Logger.log('❌ saveKnowledge エラー: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * ナレッジ削除
 */
function deleteKnowledge(id) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.TERM_DICTIONARY);
    if (!sheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEETS.TERM_DICTIONARY);

    const headerMap = getHeaderIndexMap(sheet);
    const idIdx = headerMap[TERM_DICTIONARY_HEADERS.ID];
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === id) {
        sheet.deleteRow(i + 1);
        Logger.log('✅ ナレッジ削除: ' + id);
        return { success: true, message: id + ' を削除しました' };
      }
    }

    return { success: false, error: 'ID ' + id + ' が見つかりません' };
  } catch (e) {
    Logger.log('❌ deleteKnowledge エラー: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * メールアドレスから担当者の日本語氏名を取得（内部用）
 * @param {string} email
 * @returns {string} 苗字（日本語）+ 名前（日本語）、見つからない場合は空文字
 */
function getStaffNameByEmail_(email) {
  if (!email) return '';
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
    if (!sheet || sheet.getLastRow() < 2) return '';

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailIdx = headers.indexOf('メール');
    const lastNameIdx = headers.indexOf('苗字（日本語）');
    const firstNameIdx = headers.indexOf('名前（日本語）');

    if (emailIdx === -1 || lastNameIdx === -1 || firstNameIdx === -1) return '';

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIdx] === email) {
        return (data[i][lastNameIdx] + ' ' + data[i][firstNameIdx]).trim();
      }
    }
  } catch (e) {
    Logger.log('getStaffNameByEmail_ エラー: ' + e.message);
  }
  return '';
}

/**
 * 次のナレッジIDを生成
 */
function generateNextKnowledgeId(sheet, headerMap) {
  const data = sheet.getDataRange().getValues();
  const idIdx = headerMap[TERM_DICTIONARY_HEADERS.ID];

  // データがない（ヘッダーのみ）場合は初期値
  if (data.length <= 1) {
    return 'PK-00001';
  }

  // 最終行のIDを取得
  const lastRow = data[data.length - 1];
  const lastId = lastRow[idIdx];

  if (!lastId || typeof lastId !== 'string' || !lastId.startsWith('PK-')) {
    return 'PK-00001';
  }

  const num = parseInt(lastId.replace('PK-', ''), 10);
  return 'PK-' + ('00000' + (num + 1)).slice(-5);
}
