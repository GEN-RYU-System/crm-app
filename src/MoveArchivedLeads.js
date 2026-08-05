/**
 * リード進捗が「アーカイブ」のリードをリード_アーカイブシートに移動
 */
function moveArchivedLeadsToArchiveSheet() {
  try {
    const ss = getSpreadsheet();
    const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);
    const archiveSheet = ss.getSheetByName('リード_アーカイブ');

    if (!leadsSheet) {
      throw new Error('リード管理シートが見つかりません');
    }

    if (!archiveSheet) {
      throw new Error('リード_アーカイブシートが見つかりません');
    }

    const lastRow = leadsSheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: true,
        movedCount: 0,
        message: 'リード管理シートにデータがありません'
      };
    }

    const data = leadsSheet.getDataRange().getValues();
    const headers = data[0];

    // リード進捗列のインデックスを取得
    const progressIdx = headers.indexOf('リード進捗');

    if (progressIdx === -1) {
      throw new Error('リード進捗列が見つかりません');
    }

    // アーカイブ対象の行を特定（逆順でループして削除を安全に）
    const rowsToMove = [];
    for (let i = data.length - 1; i >= 1; i--) {
      const progress = data[i][progressIdx];
      if (progress && progress.toString().trim() === 'アーカイブ') {
        rowsToMove.push({
          rowIndex: i + 1, // 1-indexed
          data: data[i]
        });
      }
    }

    if (rowsToMove.length === 0) {
      return {
        success: true,
        movedCount: 0,
        message: 'アーカイブ対象のリードはありません'
      };
    }

    // アーカイブシートのヘッダーを確認
    const archiveLastRow = archiveSheet.getLastRow();
    let archiveHeaders;

    if (archiveLastRow === 0) {
      // アーカイブシートが空の場合、ヘッダーをコピー
      archiveSheet.appendRow(headers);
      archiveHeaders = headers;
    } else {
      archiveHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0];
    }

    // アーカイブシートに行を追加
    rowsToMove.reverse(); // 元の順序に戻す
    rowsToMove.forEach(row => {
      archiveSheet.appendRow(row.data);
    });

    // リード管理シートから行を削除（逆順で削除）
    rowsToMove.reverse(); // 再度逆順にして上から削除
    rowsToMove.forEach(row => {
      leadsSheet.deleteRow(row.rowIndex);
    });

    return {
      success: true,
      movedCount: rowsToMove.length,
      message: `${rowsToMove.length}件のリードをアーカイブシートに移動しました`,
      movedLeadIds: rowsToMove.map(r => r.data[headers.indexOf('リードID')]).filter(id => id)
    };

  } catch (error) {
    Logger.log('moveArchivedLeadsToArchiveSheet error: ' + error.message);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * アーカイブ移動の確認（実際には移動せずカウントのみ）
 */
function checkArchivedLeadsCount() {
  try {
    const ss = getSpreadsheet();
    const leadsSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

    if (!leadsSheet) {
      throw new Error('リード管理シートが見つかりません');
    }

    const lastRow = leadsSheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: true,
        count: 0,
        message: 'リード管理シートにデータがありません'
      };
    }

    const data = leadsSheet.getDataRange().getValues();
    const headers = data[0];
    const progressIdx = headers.indexOf('リード進捗');
    const idIdx = headers.indexOf('リードID');
    const nameIdx = headers.indexOf('顧客名');

    if (progressIdx === -1) {
      throw new Error('リード進捗列が見つかりません');
    }

    const archivedLeads = [];
    for (let i = 1; i < data.length; i++) {
      const progress = data[i][progressIdx];
      if (progress && progress.toString().trim() === 'アーカイブ') {
        archivedLeads.push({
          leadId: data[i][idIdx] || '',
          customerName: data[i][nameIdx] || '',
          progress: progress
        });
      }
    }

    return {
      success: true,
      count: archivedLeads.length,
      archivedLeads: archivedLeads,
      message: `${archivedLeads.length}件のアーカイブ対象リードが見つかりました`
    };

  } catch (error) {
    Logger.log('checkArchivedLeadsCount error: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
