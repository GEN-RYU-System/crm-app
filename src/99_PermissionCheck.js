/**
 * 【読み取り専用】権限シートが実際に読めているかを確認する
 */
function checkPermissionSheet() {
  var ss = getSpreadsheet();
  var out = [];

  out.push('CONFIG.SHEETS.PERMISSIONS の値: "' + CONFIG.SHEETS.PERMISSIONS + '"');
  var sh = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);
  out.push('その名前でシート取得: ' +
           (sh ? 'OK' : '★null → DEFAULT_ROLES にフォールバックしている'));

  if (!sh) {
    var alt = ss.getSheetByName('権限管理');
    out.push('「権限管理」で取得: ' + (alt ? 'OK' : 'null'));
    sh = alt;
  }
  if (!sh) { Logger.log(out.join('\n')); return out.join('\n'); }

  var lastCol = sh.getLastColumn();
  out.push('');
  out.push('実タブ名: ' + sh.getName() +
           ' / ' + sh.getLastRow() + '行 x ' + lastCol + '列');
  out.push('HEADERS.PERMISSIONS 定義列数: ' + HEADERS.PERMISSIONS.length);
  out.push('');

  var row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  out.push('1行目: ' + row1.join(' | '));
  if (sh.getLastRow() >= 2) {
    out.push('2行目: ' + sh.getRange(2, 1, 1, lastCol).getValues()[0].join(' | '));
  }

  out.push('');
  out.push('staff_manage が1行目に存在: ' + (row1.indexOf('staff_manage') >= 0));

  out.push('');
  out.push('[役割別 staff_manage の値]');
  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf('staff_manage');
  if (col >= 0) {
    data.slice(1).forEach(function(r, i) {
      var name = String(r[0] || '').trim();
      if (name) out.push('  行' + (i + 2) + ' "' + name + '": ' + r[col]);
    });
  } else {
    out.push('  staff_manage 列が見つからない');
  }

  Logger.log(out.join('\n'));
  return out.join('\n');
}

/**
 * 【読み取り専用】フォームトークンの発行状況を件数で返す
 * トークンの値そのものは出力しない
 */
function checkFormTokenStatus() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('フォームトークン');
  if (!sh) { Logger.log('[NOT FOUND]'); return '[NOT FOUND]'; }
  if (sh.getLastRow() < 2) { Logger.log('発行済み0件'); return '発行済み0件'; }

  var v = sh.getDataRange().getValues();
  var h = v[0];
  var issuedIdx = h.indexOf('発行日');
  var usedIdx   = h.indexOf('使用日');
  var now = new Date();

  var total = 0, used = 0, expired = 0, active = 0;
  v.slice(1).forEach(function(r) {
    if (!String(r[0] || '').trim()) return;
    total++;
    if (String(r[usedIdx] || '').trim()) { used++; return; }
    var issued = r[issuedIdx];
    if (!(issued instanceof Date)) { active++; return; }
    var days = (now - issued) / (1000 * 60 * 60 * 24);
    if (days > 7) expired++; else active++;
  });

  var out = [
    '発行済み合計: ' + total,
    '  使用済み  : ' + used,
    '  期限切れ  : ' + expired,
    '  現在有効  : ' + active
  ];
  Logger.log(out.join('\n'));
  return out.join('\n');
}

/**
 * 【読み取り専用】ORDERS の為替レート充填状況（件数のみ）
 */
function checkExchangeRate() {
  var ss = getSpreadsheet();
  var sh = getCoreSchemaV1Sheet(ss, 'ORDERS');
  var v = sh.getDataRange().getValues();
  var h = v[0];
  var idIdx   = h.indexOf(getCoreSchemaV1HeaderName('ORDERS', 'ORDER_ID'));
  var rateIdx = h.indexOf(getCoreSchemaV1HeaderName('ORDERS', 'EXCHANGE_RATE'));
  var curIdx  = h.indexOf(getCoreSchemaV1HeaderName('ORDERS', 'CURRENCY'));

  var total = 0, rateFilled = 0, curSet = {};
  v.slice(1).forEach(function(r) {
    if (!String(r[idIdx] || '').trim()) return;
    total++;
    if (String(r[rateIdx] || '').trim() !== '') rateFilled++;
    var c = String(r[curIdx] || '').trim();
    if (c) curSet[c] = (curSet[c] || 0) + 1;
  });

  var out = [
    'オーダー件数: ' + total,
    '為替レート充填: ' + rateFilled,
    '',
    '[通貨の内訳]'
  ];
  Object.keys(curSet).forEach(function(k) { out.push('  ' + k + ': ' + curSet[k]); });

  Logger.log(out.join('\n'));
  return out.join('\n');
}
