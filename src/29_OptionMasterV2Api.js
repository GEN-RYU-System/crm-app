/**
 * 選択肢マスタV2 読み取り API（内部モジュール）
 *
 * 設計原則:
 *   - 全 category を1回のシート読み取りで取得する（GAS 3.1秒/呼び出し対策）
 *   - is_active = FALSE の行は除外する
 *   - sort_order 昇順で返す
 *   - 新シートに category が存在しない場合は空配列を返す（フォールバックは呼び出し側で対応）
 *
 * 外部公開:
 *   - getAllOptionsGroupedFromV2_()  ... { category: string[] } Map
 *   - getOptionsByCategory_(cat)     ... string[]
 *
 * フォールバック（段階6で除去予定）:
 *   新シートに category が存在しない場合、呼び出し元が DEFAULT_DROPDOWN_OPTIONS を使う。
 */

/**
 * 選択肢マスタV2 の全カテゴリを一括取得する（内部用）。
 *
 * @returns {{ [category: string]: string[] }} カテゴリ → 値配列
 */
function getAllOptionsGroupedFromV2_() {
  var ss = getSpreadsheet();
  var sheetName = getCoreSchemaV1TableName('OPTION_MASTER');
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return {};

  var data     = sheet.getDataRange().getValues();
  var headers  = data[0].map(function(h) { return String(h != null ? h : '').trim(); });
  var catIdx   = headers.indexOf('category');
  var valIdx   = headers.indexOf('value');
  var orderIdx = headers.indexOf('sort_order');
  var actIdx   = headers.indexOf('is_active');

  if (catIdx < 0 || valIdx < 0) return {};

  var rows = [];
  for (var r = 1; r < data.length; r++) {
    var isActive = actIdx < 0 ||
      data[r][actIdx] === true ||
      String(data[r][actIdx] != null ? data[r][actIdx] : '').toUpperCase() === 'TRUE';
    if (!isActive) continue;

    var cat = String(data[r][catIdx] != null ? data[r][catIdx] : '').trim();
    var val = String(data[r][valIdx] != null ? data[r][valIdx] : '').trim();
    if (!cat || !val) continue;

    var order = orderIdx >= 0 ? (Number(data[r][orderIdx]) || 0) : 0;
    rows.push({ cat: cat, val: val, order: order });
  }

  rows.sort(function(a, b) { return a.order - b.order; });

  var result = {};
  rows.forEach(function(row) {
    if (!result[row.cat]) result[row.cat] = [];
    result[row.cat].push(row.val);
  });
  return result;
}

/**
 * 指定 category の選択肢を返す（内部用）。
 * 新シートに category が存在しない場合は空配列を返す。
 *
 * @param {string} category
 * @returns {string[]}
 */
function getOptionsByCategory_(category) {
  return getAllOptionsGroupedFromV2_()[category] || [];
}
