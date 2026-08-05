function getStockData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetConfig = ERP_CONFIG.SHEETS.VIEWER_SUPPLIER_STOCK;
  const sheet = ss.getSheets().find(s => s.getSheetId().toString() === sheetConfig.ID.toString());

  if (!sheet) return []; // シートがなければ空っぽを返す

  const raw = sheet.getDataRange().getValues();
  const header = raw[0].map(String);

  // ヘッダー名から列番号を特定するヘルパー
  const findHeader = (headers, targets) => {
    for (let target of targets) {
      const i = headers.findIndex(h => String(h).toLowerCase().trim() === target.toLowerCase());
      if (i !== -1) return i;
    }
    return -1;
  };

  const idx = {
    cat: findHeader(header, ["Category", "カテゴリ", "分類", "A"]),
    mark: findHeader(header, ["Mark", "マーク"]),
    en: findHeader(header, ["English Title", "商品名(英)", "EN Title"]),
    ja: findHeader(header, ["Japanese Title", "商品名(日)", "JA Title", "商品名"]),
    st: findHeader(header, ["Status", "状態", "ステータス"]),
    cond: findHeader(header, ["Condition", "コンディション"]),
    pr: findHeader(header, ["Unit Price", "単価", "販売価格"]),
    qty: findHeader(header, ["Quantity", "数量", "在庫数"]),
    note: findHeader(header, ["Note_JA", "備考", "ノート"]),
    rel: findHeader(header, ["Release Date", "発売日"]),
    weight: findHeader(header, ["Weight", "重量", "Box重量"])
  };

  // カテゴリが見つからない場合はA列(0)をデフォルトに
  if (idx.cat === -1) idx.cat = 0;

  const data = [];
  // 1行目はヘッダーなので、i=1 からスタート
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r[idx.cat]) continue; // カテゴリがない行は無視

    data.push({
      category: String(r[idx.cat]).trim(),
      mark: String(r[idx.mark] || ""),
      enTitle: String(r[idx.en] || ""),
      jaTitle: String(r[idx.ja] || ""),
      status: String(r[idx.st] || ""),
      condition: String(r[idx.cond] || ""),
      price: parseFloat(r[idx.pr]) || 0,
      qty: parseFloat(r[idx.qty]) || 0,
      weight: parseFloat(r[idx.weight]) || 0,
      note: String(r[idx.note] || ""),
      release: r[idx.rel] ? Utilities.formatDate(new Date(r[idx.rel]), "JST", "yyyy-MM-dd") : "-"
    });
  }

  // カテゴリ一覧を作る（重複なし）
  const categories = [...new Set(data.map(d => d.category))];

  return { data: data, categories: categories };
}

function testStockData() {
  const result = getStockData();
  console.log("データの数: " + result.data.length);
  console.log("カテゴリ一覧: " + result.categories);

  if (result.data.length === 0) {
    console.log("【原因】シートIDが違うか、1行目の項目名（Categoryなど）が見つかりません。");
  } else {
    console.log("【成功】データは正しく取れています！Webアプリを再読み込みしてください。");
  }
}