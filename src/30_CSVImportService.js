
/**
 * CSVコンテンツをパースしてオブジェクト配列に変換
 *
 * @param {string} csvContent - CSVコンテンツ（UTF-8 BOM対応）
 * @returns {Array<Object>} パースされたデータ配列
 */
function parseCSV(csvContent) {
  try {
    // BOM除去
    let content = csvContent;
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.substring(1);
    }

    // 行に分割
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error('CSVファイルにデータが含まれていません');
    }

    // ヘッダー解析
    const headers = parseCSVLine(lines[0]);

    // データ行をパース
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);

      // ヘッダーと値をマッピング
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      data.push(row);
    }

    return data;
  } catch (error) {
    Logger.log('[CSVImport] parseCSV error: ' + error.message);
    throw error;
  }
}

/**
 * CSV行をパース（カンマ区切り、ダブルクォート対応）
 *
 * @param {string} line - CSV行
 * @returns {Array<string>} パースされた値の配列
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // エスケープされたダブルクォート
        current += '"';
        i++; // 次の文字をスキップ
      } else {
        // クォートの開始/終了
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // フィールドの区切り
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // 最後のフィールドを追加
  values.push(current.trim());

  return values;
}

/**
 * 次のリードIDを生成
 *
 * @param {string} type - リード種別（'インバウンド' or 'アウトバウンド'）
 * @returns {string} 生成されたリードID
 */
function generateNextLeadId(type) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('リード管理');
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      // データがない場合は最初のIDを返す
      return type === 'インバウンド' ? 'LDI-00001' : 'LDO-00001';
    }

    // 既存のリードIDを取得
    const leadIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const prefix = type === 'インバウンド' ? 'LDI-' : 'LDO-';

    // 同じプレフィックスのIDのみを抽出して番号を取得
    let maxNumber = 0;
    leadIds.forEach(row => {
      const leadId = String(row[0]);
      if (leadId.startsWith(prefix)) {
        const number = parseInt(leadId.substring(prefix.length), 10);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    // 次の番号を生成
    const nextNumber = maxNumber + 1;
    return prefix + String(nextNumber).padStart(5, '0');
  } catch (error) {
    Logger.log('[CSVImport] generateNextLeadId error: ' + error.message);
    throw error;
  }
}

/**
 * 次の顧客IDを生成
 *
 * @returns {string} 生成された顧客ID
 */
function generateNextCustomerId() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('顧客マスタ');
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return 'CT-00001';
    }

    // 既存の顧客IDを取得
    const customerIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const prefix = 'CT-';

    let maxNumber = 0;
    customerIds.forEach(row => {
      const customerId = String(row[0]);
      if (customerId.startsWith(prefix)) {
        const number = parseInt(customerId.substring(prefix.length), 10);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    const nextNumber = maxNumber + 1;
    return prefix + String(nextNumber).padStart(5, '0');
  } catch (error) {
    Logger.log('[CSVImport] generateNextCustomerId error: ' + error.message);
    throw error;
  }
}

/**
 * 次のログIDを生成
 *
 * @returns {string} 生成されたログID
 */
function generateNextLogId() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return 'LOG-00001';
    }

    // 既存のログIDを取得
    const logIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const prefix = 'LOG-';

    let maxNumber = 0;
    logIds.forEach(row => {
      const logId = String(row[0]);
      if (logId.startsWith(prefix)) {
        const number = parseInt(logId.substring(prefix.length), 10);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    const nextNumber = maxNumber + 1;
    return prefix + String(nextNumber).padStart(5, '0');
  } catch (error) {
    Logger.log('[CSVImport] generateNextLogId error: ' + error.message);
    throw error;
  }
}

/**
 * メールアドレスで既存リードを検索
 *
 * @param {string} email - メールアドレス
 * @returns {Object|null} リードデータ or null
 */
function findLeadByEmail(email) {
  try {
    if (!email || email.trim() === '') return null;

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('リード管理');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const emailIdx = headers.indexOf('email');
    if (emailIdx === -1) return null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIdx] === email) {
        // オブジェクトに変換して返す
        const lead = {};
        headers.forEach((header, idx) => {
          lead[header] = data[i][idx];
        });
        return lead;
      }
    }

    return null;
  } catch (error) {
    Logger.log('[CSVImport] findLeadByEmail error: ' + error.message);
    return null;
  }
}

/**
 * 顧客情報からリードを検索（優先順位付き）
 *
 * @param {string} customerName - 顧客名
 * @param {string} email - メールアドレス
 * @param {string} phone - 電話番号
 * @param {string} country - 国
 * @returns {Object|null} { leadId, matchType } or null
 */
function findLeadByCustomerInfo(customerName, email, phone, country) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('リード管理');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const nameIdx = headers.indexOf('customer_name');
    const emailIdx = headers.indexOf('email');
    const phoneIdx = headers.indexOf('phone');
    const countryIdx = headers.indexOf('country');
    const idIdx = headers.indexOf('lead_id');

    // 1. メールアドレスで検索（最優先）
    if (email && email.trim() !== '') {
      for (let i = 1; i < data.length; i++) {
        if (data[i][emailIdx] === email) {
          return {
            leadId: data[i][idIdx],
            matchType: 'email'
          };
        }
      }
    }

    // 2. 電話番号で検索
    if (phone && phone.trim() !== '') {
      for (let i = 1; i < data.length; i++) {
        if (data[i][phoneIdx] === phone) {
          return {
            leadId: data[i][idIdx],
            matchType: 'phone'
          };
        }
      }
    }

    // 3. 顧客名 + 国で検索
    if (country && country.trim() !== '') {
      const matches = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i][nameIdx] === customerName && data[i][countryIdx] === country) {
          matches.push(data[i][idIdx]);
        }
      }

      if (matches.length === 1) {
        return {
          leadId: matches[0],
          matchType: 'name+country'
        };
      } else if (matches.length > 1) {
        throw new Error(`MULTIPLE_MATCHES: 複数のリードが見つかりました: ${customerName}（${matches.length}件）`);
      }
    }

    // 4. 顧客名のみで検索（曖昧マッチ）
    const matches = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][nameIdx] === customerName) {
        matches.push(data[i][idIdx]);
      }
    }

    if (matches.length === 1) {
      return {
        leadId: matches[0],
        matchType: 'name_only',
        warning: '顧客名のみでマッチしました。メールアドレスでの確認を推奨します。'
      };
    } else if (matches.length > 1) {
      throw new Error(`MULTIPLE_MATCHES: 複数のリードが見つかりました: ${customerName}（${matches.length}件）`);
    }

    // 見つからない
    return null;
  } catch (error) {
    if (error.message.startsWith('MULTIPLE_MATCHES')) {
      throw error;
    }
    Logger.log('[CSVImport] findLeadByCustomerInfo error: ' + error.message);
    return null;
  }
}

/**
 * リード管理CSVをインポート
 *
 * @param {string} csvContent - CSVコンテンツ
 * @param {Object} options - インポートオプション { skipDuplicates: boolean, overwrite: boolean }
 * @returns {Object} { success: number, skipped: number, errors: Array }
 */
function importLeadsCSV(csvContent, options) {
  try {
    const data = parseCSV(csvContent);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('リード管理');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const results = {
      success: 0,
      skipped: 0,
      errors: [],
      generatedIds: []
    };

    const skipDuplicates = options.skipDuplicates !== false; // デフォルトtrue

    data.forEach((row, index) => {
      try {
        const rowNumber = index + 2; // ヘッダー行を考慮

        // 必須項目チェック
        if (!row['customer_name'] || row['customer_name'].trim() === '') {
          results.errors.push({
            row: rowNumber,
            type: 'MISSING_REQUIRED',
            message: '顧客名は必須項目です'
          });
          return;
        }

        if (!row['lead_type']) {
          results.errors.push({
            row: rowNumber,
            type: 'MISSING_REQUIRED',
            message: 'リード種別は必須項目です'
          });
          return;
        }

        // リード種別チェック
        const leadType = row['lead_type'];
        if (leadType !== 'インバウンド' && leadType !== 'アウトバウンド') {
          results.errors.push({
            row: rowNumber,
            type: 'INVALID_VALUE',
            message: `リード種別は「インバウンド」または「アウトバウンド」である必要があります: ${leadType}`
          });
          return;
        }

        // 重複チェック
        if (skipDuplicates && row['email']) {
          const existingLead = findLeadByEmail(row['email']);
          if (existingLead) {
            results.skipped++;
            results.errors.push({
              row: rowNumber,
              type: 'DUPLICATE_EMAIL',
              message: `メールアドレス重複: ${row['email']}`,
              data: row['customer_name']
            });
            return;
          }
        }

        // リードID自動生成（空またはない場合）
        let leadId = row['lead_id'];
        if (!leadId || leadId.trim() === '') {
          leadId = generateNextLeadId(leadType);
          results.generatedIds.push(leadId);
        }

        // 登録日自動設定
        const registrationDate = row['registered_at'] || new Date();

        // スプレッドシートに書き込むデータを準備
        const rowData = headers.map(header => {
          if (header === 'リードID') return leadId;
          if (header === '登録日') return registrationDate;
          if (header === 'シート更新日') return new Date();
          if (header === 'リードステータス' && !row[header]) return '新規リード';
          if (header === '問い合わせ回数' && !row[header]) return 0;
          if (header === '重複フラグ' && !row[header]) return 'FALSE';

          return row[header] || '';
        });

        // シートに追加
        sheet.appendRow(rowData);
        results.success++;

      } catch (error) {
        results.errors.push({
          row: index + 2,
          type: 'PROCESSING_ERROR',
          message: error.message,
          data: row['customer_name'] || '不明'
        });
      }
    });

    return results;
  } catch (error) {
    Logger.log('[CSVImport] importLeadsCSV error: ' + error.message);
    throw error;
  }
}

/**
 * 顧客マスタCSVをインポート
 *
 * @param {string} csvContent - CSVコンテンツ
 * @param {Object} options - インポートオプション
 * @returns {Object} { success: number, skipped: number, errors: Array }
 */
function importCustomerMasterCSV(csvContent, options) {
  try {
    const data = parseCSV(csvContent);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('顧客マスタ');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const results = {
      success: 0,
      skipped: 0,
      errors: [],
      generatedIds: []
    };

    data.forEach((row, index) => {
      try {
        const rowNumber = index + 2;

        // 必須項目チェック（最小限）
        if (!row['B Name'] || row['B Name'].trim() === '') {
          results.errors.push({
            row: rowNumber,
            type: 'MISSING_REQUIRED',
            message: 'B Name（請求先名）は必須項目です'
          });
          return;
        }

        // 顧客ID自動生成
        let customerId = row['顧客ID'];
        if (!customerId || customerId.trim() === '') {
          customerId = generateNextCustomerId();
          results.generatedIds.push(customerId);
        }

        // 登録日時自動設定
        const registrationDate = row['登録日時'] || new Date();

        // スプレッドシートに書き込むデータを準備
        const rowData = headers.map(header => {
          if (header === '顧客ID') return customerId;
          if (header === '登録日時') return registrationDate;
          if (header === '累計取引金額' && !row[header]) return 0;
          if (header === '取引回数' && !row[header]) return 0;

          return row[header] || '';
        });

        // シートに追加
        sheet.appendRow(rowData);
        results.success++;

      } catch (error) {
        results.errors.push({
          row: index + 2,
          type: 'PROCESSING_ERROR',
          message: error.message,
          data: row['B Name'] || '不明'
        });
      }
    });

    return results;
  } catch (error) {
    Logger.log('[CSVImport] importCustomerMasterCSV error: ' + error.message);
    throw error;
  }
}

/**
 * 会話ログCSVをインポート（リード自動紐付け）
 *
 * @param {string} csvContent - CSVコンテンツ
 * @param {Object} options - インポートオプション
 * @returns {Object} { success: number, skipped: number, errors: Array }
 */
function importConversationLogCSV(csvContent, options) {
  try {
    const data = parseCSV(csvContent);
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const results = {
      success: 0,
      skipped: 0,
      errors: [],
      generatedIds: []
    };

    const currentUser = getCurrentUser();

    data.forEach((row, index) => {
      try {
        const rowNumber = index + 2;

        // 必須項目チェック（新旧列名両対応）
        const originalText = row['original_text'] || row['原文'];
        if (!originalText || originalText.trim() === '') {
          results.errors.push({
            row: rowNumber,
            type: 'MISSING_REQUIRED',
            message: '原文(original_text)は必須項目です'
          });
          return;
        }

        // リードIDを検索
        let leadId = row['lead_id'];

        if (!leadId || leadId.trim() === '') {
          // リードIDがない場合、顧客情報から検索
          const matchResult = findLeadByCustomerInfo(
            row['customer_name'],
            row['email'],
            row['phone'],
            row['country']
          );

          if (!matchResult) {
            results.errors.push({
              row: rowNumber,
              type: 'LEAD_NOT_FOUND',
              message: `リードが見つかりません: ${row['customer_name']}（メール: ${row['email'] || 'なし'}）`,
              data: row['customer_name']
            });
            return;
          }

          leadId = matchResult.leadId;
        }

        // ログID自動生成
        let logId = row['log_id'];
        if (!logId || logId.trim() === '') {
          logId = generateNextLogId();
          results.generatedIds.push(logId);
        }

        // 記録日時自動設定
        const recordDate = new Date();

        // スプレッドシートに書き込むデータを準備
        const rowData = headers.map(header => {
          if (header === 'log_id')      return logId;
          if (header === 'lead_id')     return leadId;
          if (header === 'recorded_at') return recordDate;
          if (header === 'recorded_by') return currentUser.email;

          return row[header] || '';
        });

        // シートに追加
        sheet.appendRow(rowData);
        results.success++;

      } catch (error) {
        if (error.message.startsWith('MULTIPLE_MATCHES')) {
          results.errors.push({
            row: index + 2,
            type: 'MULTIPLE_MATCHES',
            message: error.message,
            data: row['customer_name']
          });
        } else {
          results.errors.push({
            row: index + 2,
            type: 'PROCESSING_ERROR',
            message: error.message,
            data: row['customer_name'] || '不明'
          });
        }
      }
    });

    return results;
  } catch (error) {
    Logger.log('[CSVImport] importConversationLogCSV error: ' + error.message);
    throw error;
  }
}
