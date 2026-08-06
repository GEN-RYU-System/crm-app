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
