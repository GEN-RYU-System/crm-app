/**
 * redaction2 のDEVブック移行専用・一時管理関数。
 * 実IDはすべて Script Properties 内だけで扱い、戻り値やログに出力しない。
 */

const REDACTION2_PENDING_DEV_PROPERTY = 'REDACTION2_PENDING_DEV_SPREADSHEET_ID';
const REDACTION2_PREVIOUS_DEV_PROPERTY = 'REDACTION2_PREVIOUS_DEV_SPREADSHEET_ID';

function redaction2CopyDevSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(REDACTION2_PENDING_DEV_PROPERTY)) {
    throw new Error('redaction2のDEVコピーが保留中です。先に切替またはロールバックしてください。');
  }

  const source = DriveApp.getFileById(getRequiredSpreadsheetProperty('DEV_SPREADSHEET_ID'));
  const copy = source.makeCopy(source.getName() + '_MIGRATED_20260824');
  properties.setProperty(REDACTION2_PENDING_DEV_PROPERTY, copy.getId());
  return { copyCreated: true };
}

function redaction2ActivateCopiedDevSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const previousId = getRequiredSpreadsheetProperty('DEV_SPREADSHEET_ID');
  const pendingId = properties.getProperty(REDACTION2_PENDING_DEV_PROPERTY);
  if (!pendingId) throw new Error('redaction2のDEVコピーがありません。先に redaction2CopyDevSpreadsheet を実行してください。');

  SpreadsheetApp.openById(pendingId);
  properties.setProperties({
    DEV_SPREADSHEET_ID: pendingId,
    [REDACTION2_PREVIOUS_DEV_PROPERTY]: previousId
  }, false);
  properties.deleteProperty(REDACTION2_PENDING_DEV_PROPERTY);
  return { devPropertySwitched: true };
}

function redaction2RollbackDevSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const previousId = properties.getProperty(REDACTION2_PREVIOUS_DEV_PROPERTY);
  if (!previousId) throw new Error('redaction2の復元元DEVプロパティがありません。');

  SpreadsheetApp.openById(previousId);
  properties.setProperty('DEV_SPREADSHEET_ID', previousId);
  return { devPropertyRestored: true };
}

function redaction2RetirePreviousDevSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const previousId = properties.getProperty(REDACTION2_PREVIOUS_DEV_PROPERTY);
  if (!previousId) throw new Error('redaction2の退役対象DEVプロパティがありません。');

  const file = DriveApp.getFileById(previousId);
  const owner = file.getOwner().getEmail();
  const originalName = file.getName();
  if (!originalName.endsWith('_RETIRED_20260824')) file.setName(originalName + '_RETIRED_20260824');

  let removedEditors = 0;
  for (const editor of file.getEditors()) {
    if (editor.getEmail() !== owner) {
      file.removeEditor(editor);
      removedEditors += 1;
    }
  }
  let removedViewers = 0;
  for (const viewer of file.getViewers()) {
    if (viewer.getEmail() !== owner) {
      file.removeViewer(viewer);
      removedViewers += 1;
    }
  }
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  properties.deleteProperty(REDACTION2_PREVIOUS_DEV_PROPERTY);
  return { retired: true, removedEditors, removedViewers, linkSharingDisabled: true };
}

function redaction2InspectErpSpreadsheet() {
  const file = DriveApp.getFileById(getRequiredSpreadsheetProperty('ERP_SPREADSHEET_ID'));
  const spreadsheet = SpreadsheetApp.openById(file.getId());
  return {
    readOnly: true,
    ownerIsCurrentUser: file.getOwner().getEmail() === Session.getEffectiveUser().getEmail(),
    editorCount: file.getEditors().length,
    viewerCount: file.getViewers().length,
    lastUpdatedAt: file.getLastUpdated().toISOString(),
    sheetCount: spreadsheet.getSheets().length
  };
}
