// ==========================================
// FLOW:
// 顧客がオーダーフォームを入力して送信した時に発火
// 1.フォーム情報を参照してCRMに顧客情報を出力
// 2.出力後、Discordにメッセージを通知して顧客のフォーム入力完了を知らせる
// ==========================================


// ==========================================
// ■ 設定エリア
// ==========================================

// 1. 各種設定（Config.jsを参照）
// clasp run対応：グローバルスコープでのAPI参照を避ける
const CRM_WEBHOOK_URL = '';  // 実行時に取得
const FORM_SHEET_ID = ERP_CONFIG.SHEETS.RAW_FORM_RESPONSES.ID;
const CRM_TARGET_GID = ERP_CONFIG.SHEETS.CUSTOMER_MASTER.ID;
const ID_PREFIX = "T";


// ==========================================
// ■ メイン関数 (フォーム送信時に実行)
// ==========================================
function transferToCRM(e) {
  console.log("🚀 処理開始: transferToCRM");

  if (!e) {
    console.error("❌ エラー: トリガーから実行してください");
    return;
  }

  const range = e.range;
  const srcSheet = range.getSheet();

  // フォーム回答シート以外なら何もしない
  if (srcSheet.getSheetId() !== FORM_SHEET_ID) return;

  const row = range.getRow();
  const lastCol = srcSheet.getLastColumn();

  // --- ① フォームの回答データを取得 ---
  const rowData = srcSheet.getRange(row, 1, 1, lastCol).getValues()[0];

  // 列のインデックス定義
  const col = {
    TIMESTAMP: 0,
    BILL_NAME: 1,
    BILL_TEL: 2,
    EMAIL: 3,
    BILL_TAX: 4,
    BILL_ADD1: 5,
    BILL_ADD2: 6,
    BILL_CITY: 7,
    BILL_STATE: 8,
    BILL_ZIP: 9,
    BILL_COUNTRY: 10,
    SHIP_OPTION: 11,
    SHIP_NAME: 12, SHIP_TEL: 13, SHIP_EMAIL: 14, SHIP_TAX: 15,
    SHIP_ADD1: 16, SHIP_ADD2: 17, SHIP_CITY: 18, SHIP_STATE: 19, SHIP_ZIP: 20, SHIP_COUNTRY: 21
  };

  // --- ② 配送先情報の整理 ---
  let shipData = {};
  const shipOption = rowData[col.SHIP_OPTION];
  const isSameAddress = shipOption && (shipOption.includes("Same") || shipOption.includes("same"));

  if (isSameAddress) {
    shipData = {
      name: rowData[col.BILL_NAME], tel: rowData[col.BILL_TEL], email: rowData[col.EMAIL],
      tax: rowData[col.BILL_TAX], add1: rowData[col.BILL_ADD1], add2: rowData[col.BILL_ADD2],
      city: rowData[col.BILL_CITY], state: rowData[col.BILL_STATE], zip: rowData[col.BILL_ZIP], country: rowData[col.BILL_COUNTRY]
    };
  } else {
    shipData = {
      name: rowData[col.SHIP_NAME], tel: rowData[col.SHIP_TEL], email: rowData[col.SHIP_EMAIL],
      tax: rowData[col.SHIP_TAX], add1: rowData[col.SHIP_ADD1], add2: rowData[col.SHIP_ADD2],
      city: rowData[col.SHIP_CITY], state: rowData[col.SHIP_STATE], zip: rowData[col.SHIP_ZIP], country: rowData[col.SHIP_COUNTRY]
    };
  }

  // --- ③ CRMシートへの書き込み ---
  try {
    const crmSs = SpreadsheetApp.getActiveSpreadsheet();
    const crmSheet = getSheetByGid(crmSs, CRM_TARGET_GID);

    if (!crmSheet) {
      console.error("❌ エラー: CRMシートが見つかりません。");
      return;
    }

    // ★ID生成ロジックの変更箇所 (ここが変わりました)
    // 既存のA列を全て読み込んで、一番大きい数字を探す
    const lastRow = crmSheet.getLastRow();
    let maxIdNum = 0;

    // データが2行以上ある場合（ヘッダー以外にデータがある場合）のみ検索
    if (lastRow > 1) {
      // A列(2行目以降)の値を取得
      const idValues = crmSheet.getRange(2, 1, lastRow - 1, 1).getValues();

      // 最大値を探すループ
      idValues.forEach(val => {
        const strVal = String(val[0]); // 例: "T0015"
        // 数字以外の文字を除去して数値化 ("T0015" -> 15)
        const numVal = parseInt(strVal.replace(/[^0-9]/g, ''), 10);

        if (!isNaN(numVal) && numVal > maxIdNum) {
          maxIdNum = numVal;
        }
      });
    }

    // 最大値 + 1 を次のIDにする
    const nextIdNum = maxIdNum + 1;
    const uniqueId = ID_PREFIX + ('0000' + nextIdNum).slice(-4);


    // 出力データの作成
    const outputData = [
      uniqueId,
      rowData[col.TIMESTAMP],
      rowData[col.BILL_NAME],
      rowData[col.EMAIL],
      rowData[col.BILL_TEL],
      rowData[col.BILL_TAX],
      rowData[col.BILL_ADD1],
      rowData[col.BILL_ADD2],
      rowData[col.BILL_CITY],
      rowData[col.BILL_STATE],
      rowData[col.BILL_ZIP],
      rowData[col.BILL_COUNTRY],
      shipData.name,
      shipData.tel,
      shipData.email,
      shipData.tax,
      shipData.add1,
      shipData.add2,
      shipData.city,
      shipData.state,
      shipData.zip,
      shipData.country
    ];

    crmSheet.appendRow(outputData);
    console.log("✅ CRMシートへの書き込み完了 ID: " + uniqueId);

    // --- ④ Discordへ通知 ---
    sendDiscordNotification(uniqueId, rowData[col.BILL_NAME], rowData[col.EMAIL], rowData[col.TIMESTAMP]);

  } catch (e) {
    console.error("❌ エラー発生: " + e.toString());
  }
}

// Discord送信機能
function sendDiscordNotification(id, name, email, timestamp) {
  const dateStr = Utilities.formatDate(new Date(timestamp), "Asia/Tokyo", "yyyy/MM/dd HH:mm");
  const message = `===========================================================
### ✅お客様より登録フォームの入力がありました。
---------------------------------------------------------------------------
登録日時:${dateStr}
顧客ID:${id}
Billing Name:${name}
Email:${email}
---------------------------------------------------------------------------
上記、ご確認ください！
===========================================================`;

  const payload = { username: "顧客登録Bot", content: message };

  try {
    UrlFetchApp.fetch(CRM_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
    console.log("✅ Discord送信完了");
  } catch (e) {
    console.error("❌ Discord送信エラー: " + e.toString());
  }
}

function getSheetByGid(ss, gid) {
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() == gid) return sheets[i];
  }
  return null;
}