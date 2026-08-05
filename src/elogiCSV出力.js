/**
 * ELOGI用CSVを出力し、指定のGoogle Driveフォルダに保存する
 * (GID:600397303 専用 / 日付フォーマット・数量列修正版)
 */
function generateElogiCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const scriptProperties = PropertiesService.getScriptProperties();
  const folderId = scriptProperties.getProperty('ELOGI_CSVFOLDER_ID');

  if (!folderId) {
    SpreadsheetApp.getUi().alert('エラー: スクリプトプロパティ「ELOGI_CSVFOLDER_ID」が設定されていません。');
    return;
  }

  const sourceSheet = getSheetByGid(ss, 600397303);
  if (!sourceSheet) {
    SpreadsheetApp.getUi().alert('エラー: 対象シートが見つかりません。');
    return;
  }

  // 1. 全データの取得
  const allData = sourceSheet.getDataRange().getValues();
  const row4 = allData[3].map(h => String(h).trim()); // 4行目（検索用）
  const row6 = allData[5]; // 6行目（CSVヘッダー用）

  // 2. 抽出対象列（4行目の名前）の定義
  const targetNames = [
    "発送情報(必須)注文種類(指定可能な値：ebay、amazon、rakuten、yahoo、その他)",
    "発送情報注文番号",
    "発送情報(必須)注文日(yyyy/mm/dd)",
    "発送情報SKU",
    "発送情報商品画像URL",
    "発送情報(必須)商品タイトル",
    "取引状況数量", // 【修正】「発送情報(必須)数量」から変更
    "発送情報(必須)ドル単価",
    "発送情報購入者ID",
    "発送情報(必須)受取人氏名",
    "発送情報(必須)電話番号",
    "発送情報メールアドレス",
    "発送情報(必須)国名",
    "発送情報州コード/州名",
    "発送情報(必須)市",
    "発送情報郵便番号",
    "発送情報(必須)住所１",
    "発送情報住所２",
    "発送情報住所３"
  ];

  // 3. 列インデックスの特定
  const colIndices = targetNames.map(name => row4.indexOf(name.trim()));
  const colIdxLabel = row4.indexOf('発送情報ラベル発行');
  const colIdxTimestamp = row4.indexOf('発送情報タイムスタンプ');

  if (colIdxLabel === -1) {
    SpreadsheetApp.getUi().alert('エラー:「発送情報ラベル発行」列が見つかりません。');
    return;
  }
  
  if (colIndices.includes(-1)) {
    const missingIdx = colIndices.indexOf(-1);
    SpreadsheetApp.getUi().alert('エラー: 列が見つかりません -> ' + targetNames[missingIdx]);
    return;
  }

  // 4. CSVデータの構築
  let csvLines = [];
  // ヘッダー行
  csvLines.push(colIndices.map(idx => `"${row6[idx]}"`).join(','));

  let processedRows = [];

  for (let i = 6; i < allData.length; i++) {
    const row = allData[i];
    if (row[colIdxLabel] === true) {
      const rowData = colIndices.map(idx => {
        let val = row[idx];
        
        // 【修正】日付オブジェクトの場合は yyyy/MM/dd 形式に変換
        if (Object.prototype.toString.call(val) === '[object Date]') {
          val = Utilities.formatDate(val, "JST", "yyyy/MM/dd");
        }
        
        // nullやundefinedの対策をしつつ文字列化・エスケープ
        return `"${String(val ?? "").replace(/"/g, '""')}"`;
      });
      csvLines.push(rowData.join(','));
      processedRows.push(i + 1);
    }
  }

  if (processedRows.length === 0) {
    SpreadsheetApp.getUi().alert('情報: チェックが入っている行はありませんでした。');
    return;
  }

  // 5. ファイル保存
  try {
    const csvContent = csvLines.join('\r\n');
    const folder = DriveApp.getFolderById(folderId);
    const now = new Date();
    const fileName = `ELOGI_${Utilities.formatDate(now, "JST", "yyyyMMdd_HHmmss")}.csv`;
    const file = folder.createFile(fileName, csvContent, MimeType.CSV);
    
    // 6. 事後処理
    const timestamp = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm");
    processedRows.forEach(rowNum => {
      sourceSheet.getRange(rowNum, colIdxTimestamp + 1).setValue(timestamp);
      sourceSheet.getRange(rowNum, colIdxLabel + 1).setValue(false);
    });

    const msg = "✅完了しました。\\n出力件数: " + (csvLines.length - 1) + " 件\\n\\nURLをコピー:\\n" + file.getUrl();
    Browser.msgBox("処理完了", msg, Browser.Buttons.OK);

  } catch (e) {
    SpreadsheetApp.getUi().alert('保存エラー: ' + e.toString());
  }
}

function getSheetByGid(ss, gid) {
  return ss.getSheets().find(s => s.getSheetId() == gid) || null;
}