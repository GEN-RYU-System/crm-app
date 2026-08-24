/**
 * ヘッダーとデータからメールアドレス列を自動検出するヘルパー関数
 */

/**
 * 値がメールアドレスかどうかをチェック
 * @param {string} value - チェックする値
 * @returns {boolean} メールアドレス形式ならtrue
 */
function isEmailFormat(value) {
  if (!value || typeof value !== 'string') return false;
  // 簡易的なメールアドレス形式チェック（@を含み、@の前後に文字がある）
  return value.includes('@') && value.indexOf('@') > 0 && value.indexOf('@') < value.length - 1;
}

/**
 * ヘッダーとデータから実際のメールアドレス列のインデックスを取得
 * @param {Array} headers - ヘッダー行
 * @param {Array} data - データ行（2次元配列）
 * @returns {number} メールアドレス列のインデックス（見つからない場合は-1）
 */
function findEmailColumnIndex(headers, data) {
  // メールアドレス候補の列名
  const emailHeaderCandidates = ['メール', 'メールアドレス', 'Email', 'email', 'E-mail', 'Discord ID'];

  // まず候補のヘッダー名で検索
  for (const candidate of emailHeaderCandidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) {
      // この列の最初の数行を確認して、実際にメールアドレスが入っているかチェック
      const sampleSize = Math.min(data.length, 3); // 最初の3行をチェック
      let emailCount = 0;

      for (let i = 0; i < sampleSize; i++) {
        if (isEmailFormat(data[i][idx])) {
          emailCount++;
        }
      }

      // 半数以上がメールアドレス形式なら、この列を採用
      if (emailCount > 0) {
        return idx;
      }
    }
  }

  // ヘッダー名では見つからなかった場合、全列をスキャンしてメールアドレスを探す
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const sampleSize = Math.min(data.length, 3);
    let emailCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      if (isEmailFormat(data[i][colIdx])) {
        emailCount++;
      }
    }

    // 半数以上がメールアドレス形式なら、この列を採用
    if (emailCount > 0) {
      return colIdx;
    }
  }

  return -1; // 見つからない
}

/**
 * メールアドレスからユーザーを検索（自動列検出版）
 * @param {string} email - 検索するメールアドレス
 * @returns {Object} ユーザー情報
 */
function findUserByEmailSmart(email) {
  try {
    const ss = SpreadsheetApp.openById(getRequiredSpreadsheetProperty('PRODUCTION_SPREADSHEET_ID'));
    const sheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'スタッフ管理シートが見つかりません' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const dataRows = data.slice(1);

    // メールアドレス列を自動検出
    const emailIdx = findEmailColumnIndex(headers, dataRows);

    if (emailIdx === -1) {
      return {
        success: false,
        error: 'メールアドレス列が見つかりません',
        debug: { headers: headers }
      };
    }

    // メールアドレスで検索
    for (let i = 0; i < dataRows.length; i++) {
      if (dataRows[i][emailIdx] === email) {
        const staffIdIdx = headers.indexOf('担当者ID');
        const lastNameJpIdx = headers.indexOf('苗字（日本語）');
        const firstNameJpIdx = headers.indexOf('名前（日本語）');
        const roleIdx = headers.indexOf('役割');
        const statusIdx = headers.indexOf('ステータス');
        const teamIdIdx = headers.indexOf('チームID');

        return {
          success: true,
          user: {
            staffId: dataRows[i][staffIdIdx],
            name: (dataRows[i][lastNameJpIdx] || '') + ' ' + (dataRows[i][firstNameJpIdx] || ''),
            email: dataRows[i][emailIdx],
            role: dataRows[i][roleIdx],
            status: dataRows[i][statusIdx],
            teamId: dataRows[i][teamIdIdx] || null
          },
          emailColumnIndex: emailIdx,
          emailColumnName: headers[emailIdx]
        };
      }
    }

    return {
      success: false,
      error: '登録されていないユーザーです',
      emailColumnIndex: emailIdx,
      emailColumnName: headers[emailIdx]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}
