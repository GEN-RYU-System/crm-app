/**
 * 選択肢マスタ サンプル取得（読み取り専用 / 調査用）
 *
 * ⚠️ このファイルは SQL マイグレーション調査専用の一時ファイルです。
 *    書き込み系メソッドは一切使用しません。
 *    調査完了後は削除を検討してください。
 */

/**
 * 選択肢マスタの「為替」「ページ」列の先頭30行サンプルを取得する（読み取り専用）
 *
 * @returns {Object} { sheetName, totalRows, sampled, 為替: string[], ページ: string[] }
 *                   エラー時は { error: string }
 */
function getOptionMasterSample() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
    if (!sheet) {
      return { error: 'シート「' + CONFIG.SHEETS.SETTINGS + '」が見つかりません' };
    }

    const allData = sheet.getDataRange().getValues();
    if (allData.length < 2) {
      return { error: 'データ行がありません（ヘッダー行のみ）' };
    }

    const headers = allData[0];
    const kawaseIdx = headers.indexOf('為替');
    const pageIdx = headers.indexOf('ページ');

    if (kawaseIdx === -1) {
      return { error: '「為替」列がヘッダー行に見つかりません', headers: headers };
    }
    if (pageIdx === -1) {
      return { error: '「ページ」列がヘッダー行に見つかりません', headers: headers };
    }

    const dataRows = allData.slice(1, 31); // 先頭30行（空行を含む）

    const kawaseValues = dataRows.map(function(row) {
      var v = row[kawaseIdx];
      if (v === '' || v === null || v === undefined) return '(空)';
      return String(v);
    });

    const pageValues = dataRows.map(function(row) {
      var v = row[pageIdx];
      if (v === '' || v === null || v === undefined) return '(空)';
      return String(v);
    });

    return {
      sheetName: CONFIG.SHEETS.SETTINGS,
      totalRows: allData.length - 1,
      sampled: dataRows.length,
      kawaseColumnIndex: kawaseIdx + 1,
      pageColumnIndex: pageIdx + 1,
      為替: kawaseValues,
      ページ: pageValues
    };
  } catch (e) {
    return { error: e.message };
  }
}
