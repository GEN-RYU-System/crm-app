/**
 * アーカイブタブ行ずれ検査（一時検証用・検証後に削除すること）
 * 1列目がリードIDパターン（LDI/LDO-NNNNN）でない行を返す。
 */
function inspectArchiveRows() {
  const ss = getSpreadsheet();
  const arch = ss.getSheetByName('リード_アーカイブ');
  const v = arch.getDataRange().getValues();
  const headers = v[0];
  const statusIdx = headers.indexOf('リード進捗');
  const dateIdx = headers.indexOf('登録日');
  const out = { headerCount: headers.length, rows: v.length - 1, badRows: [] };
  for (let i = 1; i < v.length; i++) {
    const looksOK = String(v[i][0]).match(/^LD[IO]-\d{5}$/);
    if (!looksOK) out.badRows.push({ row: i + 1, first: String(v[i][0]).slice(0, 20) });
  }
  return out;
}

/**
 * アーカイブタブ照合（一時検証用・検証後に削除すること）
 * リード管理シートと「リード_アーカイブ」タブのリードIDを比較し、
 * アーカイブタブにのみ存在するIDを返す。
 */
function reconcileArchiveTab() {
  const ss = getSpreadsheet();
  const leads = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  const arch = ss.getSheetByName('リード_アーカイブ');
  if (!leads || !arch) throw new Error('シートが見つかりません: ' + (!leads ? CONFIG.SHEETS.LEADS : 'リード_アーカイブ'));
  const pick = sh => {
    const v = sh.getDataRange().getValues();
    const i = v[0].indexOf('リードID');
    if (i < 0) throw new Error('リードID列なし: ' + sh.getName());
    return new Set(v.slice(1).map(r => r[i]).filter(String));
  };
  const L = pick(leads), A = pick(arch);
  const onlyArch = [...A].filter(id => !L.has(id));
  return { leadCount: L.size, archCount: A.size, onlyInArchive: onlyArch };
}
