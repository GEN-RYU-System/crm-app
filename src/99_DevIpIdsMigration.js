/**
 * 作品ID列 追加マイグレーション
 *
 * addLeadIpIdsColumn()
 *   リード管理シートに「作品ID」列を挿入する（冪等）。
 *   「取り扱いタイトル」列の直後に挿入し、全行は空欄のまま。
 *   変換は別ステップ（第3段階以降）で行う。
 *
 * 実行方法:
 *   clasp run addLeadIpIdsColumn
 */

/**
 * リード管理シートに「作品ID」列を追加する（冪等）。
 *
 * - 既存の「取り扱いタイトル」列の直後に挿入する。
 * - 列がすでに存在する場合は何もしない。
 * - 全行は空欄のまま（変換は別の移行ステップで行う）。
 *
 * @returns {string} 実行結果メッセージ
 */
function addLeadIpIdsColumn() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName('リード管理');
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  if (headers.indexOf('作品ID') !== -1) {
    Logger.log('列既存: 作品ID（スキップ）');
    return '列既存: 作品ID';
  }

  var titleIdx = headers.indexOf('取り扱いタイトル');
  if (titleIdx === -1) throw new Error('「取り扱いタイトル」列が見つかりません');

  // insertColumnAfter は 1-based インデックスを取る
  sheet.insertColumnAfter(titleIdx + 1);
  sheet.getRange(1, titleIdx + 2).setValue('作品ID');

  var newLastCol     = sheet.getLastColumn();
  var updatedHeaders = sheet.getRange(1, 1, 1, newLastCol).getValues()[0].map(String);
  var newIdx         = updatedHeaders.indexOf('作品ID');

  Logger.log('列追加完了: 作品ID（列' + (newIdx + 1) + '、取り扱いタイトル の直後）');
  Logger.log('総列数: ' + newLastCol);
  return '列追加完了: 作品ID（列' + (newIdx + 1) + '）、総列数: ' + newLastCol;
}
