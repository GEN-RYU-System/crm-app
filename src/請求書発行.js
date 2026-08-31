// =================================================================
// 1. 修正・差し戻しツール (監査対応版)
// =================================================================
/**
 * 選択した行のデータを「請求書作成」シートに戻し、
 * PDFを無効化して、ステータスを「修正戻し」にするツール
 */
function revertSalesToInput() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  
  // 排他制御 (5秒待機)
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    ui.alert("他ユーザーが処理中です。少し待ってから再実行してください。");
    return;
  }

  try {
    const config = setupTransferConfig();
    if (!config) return;
    const { srcSheet: inputSheet, destSheet: salesSheet, srcCol: inputCol, destCol: salesCol } = config;

    // シートチェック
    const activeSheet = ss.getActiveSheet();
    if (activeSheet.getSheetId().toString() !== "600397303") {
      ui.alert("【エラー】「取引状況」シートを選択して実行してください。");
      return;
    }

    const selection = activeSheet.getSelection().getActiveRange();
    if (!selection) {
      ui.alert("【エラー】修正したい行を選択してください。");
      return;
    }

    const startRow = selection.getRow();
    const numRows = selection.getNumRows();
    const fullSelectedData = salesSheet.getRange(startRow, 1, numRows, salesSheet.getLastColumn()).getValues();

    // -----------------------------------------------------------
    // 【監査1】複数インボイス混同チェック
    // -----------------------------------------------------------
    const invNos = fullSelectedData.map(row => {
      const val = String(row[salesCol["取引状況請求書番号"] - 1]);
      return val.includes("-") ? val.split("-")[0] : val;
    });
    const uniqueInvoices = [...new Set(invNos.filter(n => n && n !== "undefined" && n !== ""))];

    if (uniqueInvoices.length > 1) {
      ui.alert(`【停止】異なる請求書番号が混在しています。\n含まれている番号: ${uniqueInvoices.join(", ")}\n\n1つの請求書単位で選択してください。`);
      return;
    }
    // 空行選択などの対策
    if (uniqueInvoices.length === 0) {
       ui.alert("【エラー】請求書番号が取得できませんでした。有効なデータ行を選択してください。");
       return;
    }
    const targetInvNo = uniqueInvoices[0];

    // -----------------------------------------------------------
    // 【監査2】PDFの無効化処理 ([VOID]リネーム & 移動)
    // -----------------------------------------------------------
    const pdfUrl = fullSelectedData[0][salesCol["取引状況請求書リンク"] - 1];
    const cancelFolderId = props.getProperty('INVOICE_CANCEL_FOLDER_ID');

    if (pdfUrl) {
      try {
        // ID抽出ロジック強化
        const match = String(pdfUrl).match(/[-\w]{25,}/);
        if (match) {
          const fileId = match[0];
          const file = DriveApp.getFileById(fileId);
          
          const oldName = file.getName();
          if (!oldName.startsWith("[VOID]")) {
            file.setName("[VOID]_" + oldName);
          }

          if (cancelFolderId) {
            const destFolder = DriveApp.getFolderById(cancelFolderId);
            file.moveTo(destFolder);
          }
        }
      } catch (e) {
        console.warn("PDF無効化失敗 (ファイルが存在しない等): " + e.message);
      }
    }

    // -----------------------------------------------------------
    // 【監査3】ステータスを「修正戻し」へ更新
    // -----------------------------------------------------------
    const headers = salesSheet.getRange(4, 1, 1, salesSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const troubleColIdx = headers.indexOf("取引状況トラブル") + 1;

    if (troubleColIdx > 0) {
      const troubleValues = new Array(numRows).fill(["修正戻し"]);
      salesSheet.getRange(startRow, troubleColIdx, numRows, 1).setValues(troubleValues);
    }

    // -----------------------------------------------------------
    // 【監査4】入力シートへの書き戻し & 旧番号保持(J2)
    // -----------------------------------------------------------
    inputSheet.getRange("J2").setValue(targetInvNo);
    
    const firstRow = fullSelectedData[0];
    inputSheet.getRange("I2").setValue(firstRow[salesCol["取引状況通貨"] - 1]);
    inputSheet.getRange("I3").setValue(firstRow[salesCol["取引状況決済"] - 1]);
    inputSheet.getRange("I4").setValue(firstRow[salesCol["取引状況取引先名"] - 1]);
    inputSheet.getRange("I5").setValue(firstRow[salesCol["取引状況受注担当者"] - 1]);

    // 明細エリアのクリア
    inputSheet.getRange(2, 1, 17, 4).clearContent(); // A-D
    inputSheet.getRange(2, 6, 17, 1).clearContent(); // F

    // 明細データの流し込み
    if (fullSelectedData.length > 17) ui.alert("【注意】17行を超える明細はカットされます。");
    
    fullSelectedData.forEach((row, i) => {
      if (i >= 17) return;
      const r = 2 + i;
      inputSheet.getRange(r, inputCol["カテゴリ"]).setValue(row[salesCol["取引状況カテゴリ"] - 1]);
      inputSheet.getRange(r, inputCol["状態"]).setValue(row[salesCol["取引状況状態"] - 1]);
      inputSheet.getRange(r, inputCol["商品名"]).setValue(row[salesCol["取引状況商品名"] - 1]);
      inputSheet.getRange(r, inputCol["個数"]).setValue(row[salesCol["取引状況数量"] - 1]);
      inputSheet.getRange(r, inputCol["価格"]).setValue(row[salesCol["取引状況単価"] - 1]);
    });

    inputSheet.activate();
    ui.alert(`【修正モード】データを差し戻しました。\n対象: ${targetInvNo}\nPDFは無効化されました。修正後に再発行してください。`);

  } catch (err) {
    ui.alert("予期せぬエラー: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

// =================================================================
// 2. メイン処理 (修正版: lastContentRow定義漏れを解消)
// =================================================================
/**
 * メイン処理: 転記・PDF作成・保存・リンク取得を一括実行
 */
function transferAndGeneratePDF() {
  const ui = SpreadsheetApp.getUi();
  
  // 排他制御
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    ui.alert("現在、他のユーザーが処理中です。少し待ってから実行してください。");
    return;
  }

  try {
    const config = setupTransferConfig();
    if (!config) return;

    const { srcSheet, srcCol, destSheet, destCol, formatSheet, settingSheet, setCol, mstSheet, mstCol } = config;
    const normalize = (str) => String(str).replace(/[\s\u00A0]+/g, " ").trim();

    // 入力チェック
    const selectedCurrency = srcSheet.getRange("I2").getValue();
    const paymentMethod    = srcSheet.getRange("I3").getValue();
    const billingName      = srcSheet.getRange("I4").getValue(); 
    const staffName        = srcSheet.getRange("I5").getValue();

    const missingInput = [];
    if (!selectedCurrency) missingInput.push("I2: 通貨");
    if (!paymentMethod)    missingInput.push("I3: 決済方法");
    if (!billingName)      missingInput.push("I4: Billing Name");
    if (!staffName)        missingInput.push("I5: 受注担当者");

    if (missingInput.length > 0) {
      ui.alert(`【停止】必須項目が未入力です。\n未入力:\n${missingInput.join("\n")}`);
      return;
    }

    // マスタデータの照合
    const mstData = mstSheet.getDataRange().getValues();
    const mstMap = new Map();
    mstData.forEach(row => { 
      const key = row[mstCol["B Name"] - 1]; 
      if (key) mstMap.set(normalize(key), row); 
    });

    const normalizedBillingName = normalize(billingName);
    if (!mstMap.has(normalizedBillingName)) {
      ui.alert(`【停止】顧客マスタエラー\n「${billingName}」 が見つかりません。`);
      return;
    }
    const customerInfo = mstMap.get(normalizedBillingName);

    // 為替レート設定チェック
    const setAllData = settingSheet.getDataRange().getValues();
    let currentRate = 1, currentSymbol = "¥", usdRate = 150, currencyFound = false;
    
    for (let i = 1; i < setAllData.length; i++) {
      const currencyName = normalize(setAllData[i][setCol["通貨"] - 1]);
      if (currencyName === normalize(selectedCurrency)) {
        currentRate = parseFloat(setAllData[i][setCol["レート"] - 1]);
        currentSymbol = setAllData[i][setCol["為替表記"] - 1];
        currencyFound = true;
      }
      if (normalize(setAllData[i][setCol["通貨"] - 1]) === "USD") {
        usdRate = parseFloat(setAllData[i][setCol["レート"] - 1]) || 150;
      }
    }
    if (!currencyFound) {
      ui.alert(`【停止】為替設定エラー: ${selectedCurrency}`);
      return;
    }

    // 明細データ取得
    const cleanNumber = (val) => {
      const num = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
      return isNaN(num) ? 0 : num;
    };
    const roundUp2 = (num) => Math.ceil(num * 100) / 100;

    const srcSearchRange = srcSheet.getRange(1, srcCol["個数"], srcSheet.getLastRow()).getValues();
    let srcShippingJPY = 0, srcTaxJPY = 0, srcTotalJPY = 0;
    for (let i = 0; i < srcSearchRange.length; i++) {
      const label = normalize(srcSearchRange[i][0]);
      const val = cleanNumber(srcSheet.getRange(i + 1, srcCol["合計"]).getValue());
      if (label === "送料") srcShippingJPY = val;
      if (label === "TAX") srcTaxJPY = val;
      if (label === "合計") srcTotalJPY = val;
    }

    const srcData = srcSheet.getRange(2, 1, 17, srcSheet.getLastColumn()).getValues();
    const validRows = srcData.filter(row => row[srcCol["商品名"] - 1] !== "" && !isNaN(parseFloat(row[srcCol["個数"] - 1])));
    if (validRows.length === 0) {
      ui.alert("【停止】データ不足: 転記する商品データがありません。");
      return;
    }

    // 採番処理（請求書番号）
    const invColIdx = destCol["取引状況請求書番号"];
    const allInvVals = destSheet.getRange(1, invColIdx, destSheet.getLastRow(), 1).getValues();
    let lastInvStr = "";
    for (let i = allInvVals.length - 1; i >= 0; i--) {
      if (allInvVals[i][0]) { lastInvStr = String(allInvVals[i][0]); break; }
    }
    let nextInvNum = 1000; 
    if (lastInvStr) {
      const match = lastInvStr.match(/#(\d+)/);
      if (match) nextInvNum = parseInt(match[1]) + 1;
    }
    const invoiceNoMain = "#" + nextInvNum.toString().padStart(4, "0");

    // -------------------------------------------------------------
    // 【修正箇所】KEY採番 & lastContentRow の定義復活
    // -------------------------------------------------------------
    const keyColIdx = destCol["取引状況KEY"];
    const allKeyVals = destSheet.getRange(1, keyColIdx, destSheet.getLastRow(), 1).getValues();
    
    let nextKeyBase = 1;
    let lastContentRow = 0; // ★ここで変数を初期化（エラー修正）

    for (let i = allKeyVals.length - 1; i >= 0; i--) {
      // 値が入っている最後の行を探す
      if (allKeyVals[i][0] && String(allKeyVals[i][0]).trim() !== "") {
        lastContentRow = i + 1; // 1行目基準の行番号を保存
        
        const parts = String(allKeyVals[i][0]).split("-");
        const num = parseFloat(parts[0]);
        if (!isNaN(num)) { 
            nextKeyBase = num + 1; 
        }
        break; // 見つけたらループ終了
      }
    }
    // -------------------------------------------------------------

    // 請求書フォーマット書き込み
    if (formatSheet) {
      const headerRowIdx = 21; 
      const formatHeaders = formatSheet.getRange(headerRowIdx, 1, 1, formatSheet.getLastColumn()).getValues()[0];
      const fCol = {
        production: formatHeaders.indexOf("Production") + 1,
        qty: formatHeaders.indexOf("Qty") + 1,
        unitPrice: formatHeaders.indexOf("Unit Price") + 1,
        amount: formatHeaders.indexOf("Amount") + 1
      };

      // クリア & 書き込み
      const startRow = 22;
      formatSheet.getRange(startRow, fCol.production, 17, 1).clearContent();
      formatSheet.getRange(startRow, fCol.qty, 17, 1).clearContent();
      formatSheet.getRange(startRow, fCol.unitPrice, 17, 1).clearContent();
      formatSheet.getRange(startRow, fCol.amount, 17, 1).clearContent();

      // 合計欄クリア
      const totalLabelRange = formatSheet.getRange(1, fCol.unitPrice, formatSheet.getLastRow(), 1).getValues();
      for(let i=0; i<totalLabelRange.length; i++){
        const label = String(totalLabelRange[i][0]).trim();
        if(["SUBTOTAL", "SHIPPING", "TAX", "TOTAL"].includes(label)) formatSheet.getRange(i+1, fCol.amount).clearContent();
      }
      
      // インボイス番号クリア
      const fullData = formatSheet.getDataRange().getValues();
      let invoiceLabelRow = -1, invoiceLabelCol = -1;
      for(let r=0; r<fullData.length; r++){
        for(let c=0; c<fullData[r].length; c++){
          if(String(fullData[r][c]).trim().startsWith("Invoice #")){
            formatSheet.getRange(r+1, c+2).clearContent();
            invoiceLabelRow = r + 1; invoiceLabelCol = c + 2; 
          }
        }
      }

      // 明細書き込み
      let subtotal = 0;
      const numFmt = { minimumFractionDigits: (selectedCurrency === "JPY" ? 0 : 2), maximumFractionDigits: (selectedCurrency === "JPY" ? 0 : 2) };
      validRows.forEach((row, i) => {
        const qty = cleanNumber(row[srcCol["個数"] - 1]);
        const priceJPY = cleanNumber(row[srcCol["価格"] - 1]);
        const convertedPrice = roundUp2(priceJPY / currentRate);
        const convertedAmount = roundUp2(convertedPrice * qty);
        subtotal += convertedAmount;
        formatSheet.getRange(22 + i, fCol.production).setValue(row[srcCol["請求書項目"] - 1]);
        formatSheet.getRange(22 + i, fCol.qty).setValue(qty);
        formatSheet.getRange(22 + i, fCol.unitPrice).setValue(currentSymbol + convertedPrice.toLocaleString(undefined, numFmt));
        formatSheet.getRange(22 + i, fCol.amount).setValue(currentSymbol + convertedAmount.toLocaleString(undefined, numFmt));
      });

      // 合計欄
      const shippingConv = roundUp2(srcShippingJPY / currentRate);
      const taxConv = roundUp2(srcTaxJPY / currentRate);
      const totalConv = roundUp2(subtotal + shippingConv + taxConv);
      
      for (let i = 0; i < totalLabelRange.length; i++) {
        const label = String(totalLabelRange[i][0]).trim();
        const targetCell = formatSheet.getRange(i + 1, fCol.amount);
        if (label === "SUBTOTAL") targetCell.setValue(currentSymbol + subtotal.toLocaleString(undefined, numFmt));
        if (label === "SHIPPING") targetCell.setValue(currentSymbol + shippingConv.toLocaleString(undefined, numFmt));
        if (label === "TAX")      targetCell.setValue(currentSymbol + taxConv.toLocaleString(undefined, numFmt));
        if (label === "TOTAL")    targetCell.setValue(currentSymbol + totalConv.toLocaleString(undefined, numFmt));
      }

      if (invoiceLabelRow !== -1) formatSheet.getRange(invoiceLabelRow, invoiceLabelCol).setValue(invoiceNoMain);

      formatSheet.getRange("B38").setValue(`Exchange Rate: 1 ${selectedCurrency} = ${currentRate.toFixed(2)} JPY`);
      SpreadsheetApp.flush();
    }

    // PDF作成
    const pdfUrl = createInvoicePDF_Internal(invoiceNoMain);
    if (pdfUrl === "PDF作成失敗") {
       ui.alert("【停止】PDF作成に失敗しました。");
       return;
    }

    // 取引状況シートへの転記 (★ここで lastContentRow を使用)
    const writeStartRow = Math.max(5, lastContentRow + 1);
    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(today.getDate() + 2); 

    // 【監査機能】旧データのキャンセル処理
    const oldInvNo = srcSheet.getRange("J2").getValue();
    const salesHeaders = destSheet.getRange(4, 1, 1, destSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const troubleColIdx = salesHeaders.indexOf("取引状況トラブル") + 1;

    if (oldInvNo && String(oldInvNo).trim() !== "" && troubleColIdx > 0) {
      const allInvNos = destSheet.getRange(1, invColIdx, destSheet.getLastRow(), 1).getValues();
      for (let i = 0; i < allInvNos.length; i++) {
        const currentVal = String(allInvNos[i][0]).split("-")[0];
        if (currentVal === String(oldInvNo)) {
          destSheet.getRange(i + 1, troubleColIdx).setValue("キャンセル（済）");
        }
      }
    }

    // 転記データの作成
    const targetRange = destSheet.getRange(writeStartRow, 1, validRows.length, destSheet.getLastColumn());
    const existingFormulas = targetRange.getFormulas();

    const uploadData = validRows.map((row, index) => {
      const branch = "-" + (index + 1).toString().padStart(2, "0");
      const newRow = new Array(destSheet.getLastColumn()).fill("");

      newRow[destCol["取引状況KEY"] - 1] = nextKeyBase + branch; 
      newRow[destCol["取引状況請求書番号"] - 1] = invoiceNoMain + branch;
      
      const rawProductName = row[srcCol["商品名"] - 1];
      newRow[destCol["取引状況商品名"] - 1] = String(rawProductName).replace(/^\[.*?\]\s*/, '');
      newRow[destCol["取引状況数量"] - 1] = cleanNumber(row[srcCol["個数"] - 1]);
      newRow[destCol["取引状況単価"] - 1] = cleanNumber(row[srcCol["価格"] - 1]);
      newRow[destCol["取引状況通貨"] - 1] = selectedCurrency;
      newRow[destCol["取引状況決済"] - 1] = paymentMethod;
      newRow[destCol["取引状況取引先名"] - 1] = billingName;
      newRow[destCol["取引状況受注担当者"] - 1] = staffName;

      if (index === 0) {
        newRow[destCol["取引状況送料"] - 1] = srcShippingJPY;
        newRow[destCol["取引状況関税"] - 1] = srcTaxJPY;
        newRow[destCol["取引状況合計"] - 1] = srcTotalJPY;
      }

      if (destCol["取引状況カテゴリ"]) newRow[destCol["取引状況カテゴリ"] - 1] = row[srcCol["カテゴリ"] - 1];
      if (destCol["取引状況状態"])     newRow[destCol["取引状況状態"] - 1]     = row[srcCol["状態"] - 1];
      if (destCol["取引状況請求書内容"]) newRow[destCol["取引状況請求書内容"] - 1] = row[srcCol["請求書項目"] - 1];
      if (destCol["取引状況請求書発行日"]) newRow[destCol["取引状況請求書発行日"] - 1] = today;
      if (destCol["取引状況支払期日"])     newRow[destCol["取引状況支払期日"] - 1]     = dueDate;
      if (destCol["取引状況請求書リンク"]) newRow[destCol["取引状況請求書リンク"] - 1] = pdfUrl;

      if (destCol["取引状況為替レート"]) {
        newRow[destCol["取引状況為替レート"] - 1] = (selectedCurrency !== "JPY") ? parseFloat(currentRate).toFixed(2) : "";
      }

      // マスタ情報
      if (customerInfo) {
        const mstFields = [
          { m: "fedex_id",    d: "発送情報FedEx ID" },
          { m: "顧客ID",      d: "発送情報顧客ID" },
          { m: "D Name",      d: "発送情報受取人氏名" },
          { m: "D Telephone", d: "発送情報電話番号" },
          { m: "D Email",     d: "発送情報メールアドレス" },
          { m: "D Tax ID",    d: "発送情報TAX Number" },
          { m: "D Tax ID",    d: "発送情報Tax ID" },
          { m: "D Address 1", d: "発送情報住所1" },
          { m: "D Address 2", d: "発送情報住所2" },
          { m: "D Address 3", d: "発送情報住所3" },
          { m: "D City",      d: "発送情報都市名" },
          { m: "D State",     d: "発送情報州" },
          { m: "D Zip",       d: "発送情報ZIP CODE" },
          { m: "D Country",   d: "発送情報国名" },
          { m: "支払い名義",  d: "取引状況支払い名義" },
          { m: "営業担当者",  d: "取引状況営業担当者" }
        ];
        mstFields.forEach(map => {
          if (mstCol[map.m] && destCol[map.d]) {
            newRow[destCol[map.d] - 1] = customerInfo[mstCol[map.m] - 1];
          }
        });
      }

      // 発送情報(USD換算)
      if (destCol["発送情報$内容品単価"]) newRow[destCol["発送情報$内容品単価"] - 1] = roundUp2(cleanNumber(row[srcCol["価格"] - 1]) / usdRate);
      if (destCol["発送情報為替レート"]) newRow[destCol["発送情報為替レート"] - 1] = roundUp2(usdRate);

      // 品目・HSコード
      const rowCategory = normalize(row[srcCol["カテゴリ"] - 1]);
      let setRow;
      if (setCol["カテゴリ"]) setRow = setAllData.find(r => normalize(r[setCol["カテゴリ"] - 1]) === rowCategory);
      if (!setRow) setRow = setAllData.find(r => normalize(r[setCol["状態"] - 1]) === rowCategory);

      if (setRow) {
        newRow[destCol["発送情報品目"] - 1] = `${setRow[setCol["内容品名"] - 1]} ${newRow[destCol["取引状況数量"] - 1]} ${setRow[setCol["単位"] - 1]}`;
        newRow[destCol["発送情報HSコード"] - 1] = setRow[setCol["HTS"] - 1];
      }

      // 数式保護
      const currentRowFormulas = existingFormulas[index];
      for (let col = 0; col < newRow.length; col++) {
         if (currentRowFormulas[col] && String(currentRowFormulas[col]).startsWith("=")) {
             newRow[col] = currentRowFormulas[col];
         }
      }
      return newRow;
    });

    targetRange.setValues(uploadData);

    // 処理完了後、J2（旧番号）をクリアする
    srcSheet.getRange("J2").clearContent();

    ui.alert("処理完了: " + invoiceNoMain);

  } catch (err) { ui.alert("予期せぬエラー発生: " + err.message); }
  finally {
    lock.releaseLock();
  }
}

// =================================================================
// 3. 共通ヘルパー関数 (Config設定)
// =================================================================
function setupTransferConfig() {
  const ui = SpreadsheetApp.getUi();
  const GIDS = { SRC: "1761617187", DEST: "600397303", MST: "884228295", FORMAT: "74688869", SETTING: "1159512127" };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const getS = (gid) => ss.getSheets().find(s => s.getSheetId().toString() === gid) || null;
  
  const config = { 
    srcSheet: getS(GIDS.SRC), 
    destSheet: getS(GIDS.DEST), 
    mstSheet: getS(GIDS.MST),
    formatSheet: getS(GIDS.FORMAT), 
    settingSheet: getS(GIDS.SETTING) 
  };
  
  const missingSheets = [];
  if (!config.srcSheet) missingSheets.push("請求書作成(SRC)");
  if (!config.destSheet) missingSheets.push("取引状況(DEST)");
  if (!config.mstSheet) missingSheets.push("顧客マスタ(MST)");
  if (!config.formatSheet) missingSheets.push("請求書(FORMAT)");
  if (!config.settingSheet) missingSheets.push("初期設定(SETTING)");

  if (missingSheets.length > 0) {
    ui.alert(`【停止】シートが見つかりません:\n${missingSheets.join("\n")}`);
    return null;
  }

  const getCols = (sheet, row, names, isOptional = false) => {
    const headers = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
    const map = {};
    const missing = [];
    names.forEach(n => { 
      const i = headers.indexOf(n.toLowerCase()); 
      if (i !== -1) map[n] = i + 1; 
      else missing.push(n);
    });

    if (missing.length > 0 && !isOptional) {
      ui.alert(`【停止】シート「${sheet.getName()}」に以下の列が見つかりません:\n${missing.join("\n")}`);
      return null;
    }
    return map;
  };

  config.srcCol = getCols(config.srcSheet, 1, ["カテゴリ", "状態", "商品名", "個数", "請求書項目", "価格", "合計"]);
  if (!config.srcCol) return null;

  config.destCol = getCols(config.destSheet, 4, [
    "取引状況商品名", "取引状況数量", "取引状況単価", "取引状況合計", 
    "取引状況KEY", "取引状況請求書番号", "取引状況請求書リンク",
    "発送情報$内容品単価", "発送情報為替レート", "取引状況送料", "取引状況関税", 
    "取引状況通貨", "取引状況決済", "取引状況取引先名", "取引状況受注担当者", 
    "発送情報品目", "発送情報HSコード",
    "取引状況カテゴリ", "取引状況状態", "取引状況請求書内容",
    "取引状況請求書発行日", "取引状況支払期日", "取引状況為替レート",
    "発送情報受取人氏名", "発送情報電話番号", "発送情報メールアドレス", "発送情報TAX Number",
    "発送情報住所1", "発送情報住所2", "発送情報住所3", "発送情報都市名", "発送情報州", 
    "発送情報ZIP CODE", "発送情報国名", "発送情報FedEx ID", "発送情報顧客ID", "発送情報Tax ID",
    "取引状況支払い名義", "取引状況営業担当者"
  ]);
  
  if (!config.destCol) return null;
  
  config.mstCol = getCols(config.mstSheet, 1, [
    "B Name",
    "D Name", "D Telephone", "D Email", "D Tax ID", "D Address 1", "D Address 2", "D Address 3",
    "D City", "D State", "D Zip", "D Country", "営業担当者", "顧客ID", "支払い名義", "fedex_id"
  ]);
  if (!config.mstCol) return null;

  config.setCol = getCols(config.settingSheet, 1, ["状態", "内容品名", "単位", "通貨", "レート", "為替表記", "HTS"]);
  if (!config.setCol) return null;

  const optionalCol = getCols(config.settingSheet, 1, ["カテゴリ"], true);
  if (optionalCol && optionalCol["カテゴリ"]) config.setCol["カテゴリ"] = optionalCol["カテゴリ"];

  return config;
}

/**
 * 修正版：PDF作成用内部関数
 * CONFIG定義に基づき、GIDでシートを特定する堅牢な仕様に変更
 */
function createInvoicePDF_Internal(invoiceNo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // CONFIGからフォルダIDを取得
  const folderInput = CONFIG.DRIVE.INVOICE_FOLDER_ID;
  
  // 1. 引数が空の場合のデフォルト値
  if (!invoiceNo) {
    // 請求書作成シート（INVOICE_INPUT）をCONFIGから取得
    const inputSheet = getSheetByConfig(ERP_CONFIG.SHEETS.INVOICE_INPUT);
    if (inputSheet) {
      const fallbackNo = inputSheet.getRange("L2").getValue();
      invoiceNo = fallbackNo ? "#" + fallbackNo : "No_Number";
    } else {
      invoiceNo = "No_Number";
    }
  }

  // 2. 権限スコープの強制アクティベート
  DriveApp.getRootFolder(); 
  
  if (!folderInput) return "PDF作成失敗(フォルダ設定なし)";
  const folderId = folderInput.split("folders/")[1] ? folderInput.split("folders/")[1].split(/[?#]/)[0] : folderInput;

  const fileName = invoiceNo + ".pdf";

  // 3. 請求書テンプレートのシート特定
  // 【修正】ERP_CONFIG.SHEETS.INVOICE_TEMPLATE (ID: 74688869) を使用して取得
  const formatSheet = getSheetByConfig(ERP_CONFIG.SHEETS.INVOICE_TEMPLATE);

  if (!formatSheet) {
    console.error(`エラー: テンプレートシートが見つかりません。(ID: ${ERP_CONFIG.SHEETS.INVOICE_TEMPLATE.ID})`);
    return "PDF作成失敗(シート不在)";
  }
  
  const targetSheetId = formatSheet.getSheetId();

  // 4. エクスポートURL構築
  const exportUrl = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export?` +
    `format=pdf&gid=${targetSheetId}&size=A4&portrait=true&fitw=true&` +
    `top_margin=0.50&bottom_margin=0.50&left_margin=0.50&right_margin=0.50&` +
    `sheetnames=false&printtitle=false&gridlines=false&fzr=false`;

  try {
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(exportUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      muteHttpExceptions: true
    });

    const contentType = response.getHeaders()['Content-Type'];

    // 5. HTML返却チェック
    if (response.getResponseCode() !== 200 || (contentType && contentType.indexOf('application/pdf') === -1)) {
      console.error("PDF生成失敗: レスポンスがPDFではありません。");
      return "PDF作成失敗";
    }

    // 6. ファイル作成
    const blob = response.getBlob().setName(fileName).setContentType(MimeType.PDF);
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    
    // 7. 権限付与
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 8. 直リンクを返す
    return "https://drive.google.com/uc?export=download&id=" + file.getId();

  } catch (e) {
    console.error("PDFエラー: " + e.message);
    return "PDF作成失敗";
  }
}