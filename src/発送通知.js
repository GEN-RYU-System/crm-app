function transferDataToShippingNotice() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const salesSheet = ss.getSheetByName("📊売上データ");
  // const invoice = ss.getSheetByName("CRM"); // CRMシートの使用を廃止
  const workSheet = ss.getSheetByName("発送通知作業用");
  // ★★★ 変更点1: outputSheet名を「📤発送通知」に変更 ★★★
  const outputSheet = ss.getSheetByName("📤発送通知") || ss.insertSheet("📤発送通知"); 

  // --- シート存在チェック ---
  if (!salesSheet || !workSheet || !outputSheet) {
    // outputSheetは存在しなければ作成されるため、salesSheetとworkSheetのみチェック
    SpreadsheetApp.getUi().alert("必要なシート（📊売上データ, 発送通知作業用, 📤発送通知）が見つかりません。");
    return;
  }
  
  // --- 設定（ヘッダ検索用） ---
  const salesHeaderRow = 4;
  const salesDataStartRow = 7;

  // ★★★ 変更点2: チェック列のヘッダー名を「発送情報発送」に変更 ★★★
  const headerNames = {
    check: "発送情報発送",          // 既存の「売上管理/発送」相当
    done: "発送情報通知",         // 既存の「売上管理/通知」相当
    shipper: "発送情報発送方法",      // 既存の「売上管理/発送方法」相当
    tracking: "発送情報運送状番号",   // 既存の「売上管理/運送状番号」相当
    product: "取引状況商品名",         // 既存の「売上管理/請求書内容」相当
    qty: "取引状況数量",          // 既存の「売上管理/数量」相当
    customer: "取引状況取引先名"    // 既存の「売上管理/取引先名」相当 (購入者IDとして利用)
  };

  // --- ヘッダから列番号を探す（小文字化・全角スラッシュ対応） ---
  function findColByHeader(sheet, headerRow, word) {
    const lastCol = sheet.getLastColumn();
    // シートが存在しない場合はエラーを避けるためにnullを返す
    if (lastCol < 1) return null;
    
    const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
    const normalize = str => String(str || "").trim().toLowerCase().replace(/／/g, "/");
    const target = normalize(word);
    
    for (let c = 0; c < headers.length; c++) {
      if (normalize(headers[c]) === target) {
        return c + 1;
      }
    }
    Logger.log("Header search: '" + word + "' not found.");
    return null;
  }

  // --- 売上管理列番号取得 ---
  const checkCol = findColByHeader(salesSheet, salesHeaderRow, headerNames.check);
  const doneCol = findColByHeader(salesSheet, salesHeaderRow, headerNames.done);
  const shipperCol = findColByHeader(salesSheet, salesHeaderRow, headerNames.shipper);
  const trackingCol = findColByHeader(salesSheet, salesHeaderRow, headerNames.tracking);
  const productCol = findColByHeader(salesSheet, salesHeaderRow, headerNames.product);
  const qtyCol = findColByHeader(salesSheet, salesHeaderRow, headerNames.qty);
  const customerCol = findColByHeader(salesSheet, salesHeaderRow, headerNames.customer);

  if (!checkCol || !doneCol || !shipperCol || !trackingCol || !productCol || !qtyCol || !customerCol) {
    SpreadsheetApp.getUi().alert("必要なヘッダが見つかりません。売上データシートの4行目を確認してください。");
    return;
  }

  // --- 売上管理データ取得 ---
  const lastRowSales = salesSheet.getLastRow();
  if (lastRowSales < salesDataStartRow) {
      SpreadsheetApp.getUi().alert("売上管理シートにデータがありません。");
      return;
  }
  const salesValues = salesSheet.getRange(salesDataStartRow, 1, lastRowSales - salesDataStartRow + 1, salesSheet.getLastColumn()).getValues();

  const selected = [];
  const selectedRowNumbers = [];
  for (let i = 0; i < salesValues.length; i++) {
    // salesValues[i]のインデックスは列番号-1
    const val = salesValues[i][checkCol - 1]; 
    if (val == true) { 
      selected.push(salesValues[i]);
      selectedRowNumbers.push(salesDataStartRow + i);
    }
  }

  if (selected.length === 0) {
    SpreadsheetApp.getUi().alert("チェックが入った行がありません。");
    return;
  }
  if (selected.length > 20) {
    SpreadsheetApp.getUi().alert("一度に処理できる品数（20個）を超えています。");
    return;
  }

  // --- 基準値 ---
  const base = selected[0];
  const baseTracking = String(base[trackingCol - 1] || "").trim();
  const baseShipper = String(base[shipperCol - 1] || "").trim();
  const baseCustomer = String(base[customerCol - 1] || "").trim(); // 取引先名/購入者ID

  // --- 行間整合性チェック ---
  for (let i = 1; i < selected.length; i++) {
    if (String(selected[i][trackingCol - 1] || "").trim() !== baseTracking) {
      SpreadsheetApp.getUi().alert("追跡番号が異なる行を指定しています。");
      return;
    }
    if (String(selected[i][shipperCol - 1] || "").trim() !== baseShipper) {
      SpreadsheetApp.getUi().alert("発送会社が異なる行を指定しています。");
      return;
    }
    if (String(selected[i][customerCol - 1] || "").trim() !== baseCustomer) {
      SpreadsheetApp.getUi().alert("取引先名（購入者ID）が異なる行を指定しています。");
      return;
    }
  }

  // --- 商品リスト作成 ---
  const productsList = selected.map(r =>
    `${String(r[productCol - 1] || "").trim()} x${String(r[qtyCol - 1] || "").trim()}`
  ).join("\n");

  // --- 表示名取得（CRMロジックは削除し、customer名をそのまま使用） ---
  let displayName = baseCustomer; 
  

  // --- 発送会社情報をシートから取得 ---
  function buildTrackingInfo(shipperRaw, trackingNo) {
    const lastRowWork = workSheet.getLastRow();
    // テンプレートがE2:Fの範囲で想定されているため、最低2行のデータがあるか確認
    if (lastRowWork < 2) {
        return null;
    }
    const shipperListValues = workSheet.getRange("E2:F" + lastRowWork).getValues();
    const shipperMap = shipperListValues
      .filter(row => row[0] && row[1]) 
      .map(row => ({
        name: String(row[0]).trim(),
        urlTemplate: String(row[1]).trim()
      }));

    const shipperLower = shipperRaw.trim().toLowerCase();
    const encodedTrackingNo = encodeURIComponent(trackingNo);

    for (const shipper of shipperMap) {
      if (shipperLower.includes(shipper.name.trim().toLowerCase())) {
        const url = shipper.urlTemplate.includes('{{TRACKING_NUMBER}}')
          ? shipper.urlTemplate.replace('{{TRACKING_NUMBER}}', encodedTrackingNo)
          : shipper.urlTemplate + encodedTrackingNo;
        return { name: shipper.name, url: url };
      }
    }
    return null;
  }

  const shipInfo = buildTrackingInfo(baseShipper, baseTracking);
  if (!shipInfo) {
    SpreadsheetApp.getUi().alert(
      "発送会社が見つかりません。\n\n" +
      `会社名: "${baseShipper}"\n\n` +
      "「発送通知作業用」シートのE列に登録されているか確認してください。"
    );
    return;
  }

  // --- 発送通知テンプレートをシートから作成 ---
  const templateValues = workSheet.getRange("A2:B7").getValues();

  // displayNameはbaseCustomer（取引先名）と等しくなる
  const placeholderMap = {
    "{{取引先名}}": displayName, 
    "{{商品リスト}}": productsList,
    "{{追跡番号}}": baseTracking,
    "{{発送会社名}}": shipInfo.name,
    "{{追跡URL}}": shipInfo.url
  };

  let message = "";
  for (let i = 0; i < templateValues.length - 1; i++) { 
    const templatePart = templateValues[i][0];
    const placeholderKey = String(templateValues[i][1]).trim();

    message += templatePart;
    if (placeholderKey && placeholderMap[placeholderKey]) {
      message += placeholderMap[placeholderKey];
    }
  }
  message += templateValues[templateValues.length - 1][0];


  // スプレッドシートから取得した「\n」という文字列を、実際の改行コードに変換
  const formattedMessage = message.replace(/\\n/g, '\n');


  // --- 発送通知シートに出力 ---
  const outputCell = outputSheet.getRange("B2");
  outputSheet.getRange("A1").setValue("宛先");
  outputSheet.getRange("B1").setValue(displayName);
  outputCell.clearContent();
  outputCell.setValue(formattedMessage);


  // --- 完了記録とチェック解除 ---
  for (let r of selectedRowNumbers) {
    salesSheet.getRange(r, doneCol).setValue("完了");
    salesSheet.getRange(r, checkCol).setValue(false);
  }

  SpreadsheetApp.getUi().alert("発送通知を作成しました。");
}