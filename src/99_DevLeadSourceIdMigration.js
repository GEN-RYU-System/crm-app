/**
 * 流入元ID列 追加マイグレーション
 *
 * addLeadSourceIdColumn() … リード管理シートに「流入元ID」列を挿入する（冪等）
 *
 * 実行方法:
 *   clasp run addLeadSourceIdColumn
 *
 * 実行後:
 *   clasp run runCoreSchemaConformanceAudit で総不一致 0 を確認する
 */

/**
 * リード管理シートに「流入元ID」列を追加する（冪等）。
 *
 * - 既存の「流入経路」列の直後に挿入する。
 * - 列がすでに存在する場合は何もしない。
 * - 全行は空欄のまま（変換は別の移行ステップで行う）。
 *
 * @returns {string} 実行結果メッセージ
 */
function addLeadSourceIdColumn() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName('リード管理');
  if (!sheet) throw new Error('リード管理シートが見つかりません');

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  if (headers.indexOf('流入元ID') !== -1) {
    Logger.log('列既存: 流入元ID（スキップ）');
    return '列既存: 流入元ID';
  }

  var sourceIdx = headers.indexOf('流入経路');
  if (sourceIdx === -1) throw new Error('「流入経路」列が見つかりません');

  // insertColumnAfter は 1-based インデックスを取る
  sheet.insertColumnAfter(sourceIdx + 1);
  sheet.getRange(1, sourceIdx + 2).setValue('流入元ID');

  var newLastCol     = sheet.getLastColumn();
  var updatedHeaders = sheet.getRange(1, 1, 1, newLastCol).getValues()[0].map(String);
  var newIdx         = updatedHeaders.indexOf('流入元ID');

  Logger.log('列追加完了: 流入元ID（列' + (newIdx + 1) + '、流入経路 の直後）');
  Logger.log('総列数: ' + newLastCol);
  return '列追加完了: 流入元ID（列' + (newIdx + 1) + '）、総列数: ' + newLastCol;
}
