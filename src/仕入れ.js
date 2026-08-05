//仕入れ送付用テンプレを作成
function CreatePurchaseMessage() {
  const sheetName = "仕入れ"; // 対象シート名に置き換えてください
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  //海外発送用のテンプレートを作成
  //転記元のデータを指定
  const p1values = sheet.getRange("Y17").getValues();
  // 転記先にデータを貼り付け
  sheet.getRange("B15").setValues(p1values);

  //国内発送用のテンプレートを作成
  //転記元のデータを指定
  const p2values = sheet.getRange("Z17").getValues();
  // 転記先にデータを貼り付け
  sheet.getRange("B16").setValues(p2values);
}

//見積もりの送付用テンプレをリセット
function ClearPurchaseMessage() {
  const sheetName = "仕入れ"; // 対象シート名に置き換えてください
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  //入力データをリセット
  sheet.getRange('B2:E13').clearContent();
  //テンプレートをリセット
  sheet.getRange('B15:B16').clearContent();

}  