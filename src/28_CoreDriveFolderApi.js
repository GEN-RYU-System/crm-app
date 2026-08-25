var CORE_DRIVE_FOLDER_KEYS = ['帳票_見積書保存先フォルダID', '帳票_請求書保存先フォルダID', '帳票_発送ラベル保存先フォルダID', '帳票_仕入請求書保存先フォルダID'];

function getCoreDriveFoldersForFrontend(sessionId) {
  setEmailFromSession(sessionId);
  checkPermission('issuer_manage');
  var values = {};
  CORE_DRIVE_FOLDER_KEYS.forEach(function(key) { values[key] = String(getSettingValue(key) || ''); });
  return { success: true, folders: values };
}

function updateCoreDriveFolderForFrontend(sessionId, key, value) {
  setEmailFromSession(sessionId);
  checkPermission('issuer_manage');
  if (CORE_DRIVE_FOLDER_KEYS.indexOf(key) === -1) throw new Error('DRIVE_FOLDER_KEY_INVALID');
  var folderId = extractCoreDriveFolderId_(value);
  if (folderId) {
    var folder;
    try { folder = DriveApp.getFolderById(folderId); } catch (e) { throw new Error('DRIVE_FOLDER_NOT_ACCESSIBLE'); }
    if (!folder || !folder.getName()) throw new Error('DRIVE_FOLDER_NOT_ACCESSIBLE');
    // getEditors verifies edit access without creating a file.
    try { folder.getEditors(); } catch (e2) { throw new Error('DRIVE_FOLDER_NOT_EDITABLE'); }
  }
  var ss = getSpreadsheet(); var table = getCoreSchemaV1Table('SETTINGS'); var sheet = getCoreSchemaV1Sheet(ss, 'SETTINGS');
  var headers = sheet.getRange(table.headerRowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  var keyCol = headers.indexOf(getCoreSchemaV1HeaderName('SETTINGS', 'SETTING_KEY')) + 1;
  var valueCol = headers.indexOf(getCoreSchemaV1HeaderName('SETTINGS', 'SETTING_VALUE')) + 1;
  var updatedCol = headers.indexOf(getCoreSchemaV1HeaderName('SETTINGS', 'UPDATED_AT')) + 1;
  if (!keyCol || !valueCol) throw new Error('CORE_SCHEMA_REQUIRED_HEADER_MISSING');
  var keys = sheet.getRange(table.headerRowNumber + 1, keyCol, Math.max(0, sheet.getLastRow() - table.headerRowNumber), 1).getValues();
  var index = keys.findIndex(function(row) { return row[0] === key; });
  if (index < 0) throw new Error('DRIVE_FOLDER_SETTING_NOT_FOUND');
  var row = table.headerRowNumber + 1 + index;
  sheet.getRange(row, valueCol).setValue(folderId);
  if (updatedCol) sheet.getRange(row, updatedCol).setValue(new Date().toISOString());
  SpreadsheetApp.flush();
  return { success: true, folderId: folderId };
}

function extractCoreDriveFolderId_(value) {
  var raw = String(value || '').trim(); if (!raw) return '';
  var match = raw.match(/(?:drive\.google\.com\/(?:drive\/folders\/|open\?id=))([A-Za-z0-9_-]{10,})/) || raw.match(/^([A-Za-z0-9_-]{10,})$/);
  if (!match) throw new Error('DRIVE_FOLDER_ID_INVALID');
  return match[1];
}
