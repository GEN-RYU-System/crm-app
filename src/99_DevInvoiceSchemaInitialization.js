/**
 * Core Schema RegistryをSSOTとして、DEVに請求書2表の空スキーマだけを作成する。
 * 既存表・業務データ・請求書発行処理には触れない。
 */
const DEV_INVOICE_SCHEMA_INITIALIZATION_VERSION = '1';
const DEV_INVOICE_SCHEMA_INITIALIZATION_TABLE_KEYS = ['INVOICES', 'INVOICE_LINES'];
const DEV_INVOICE_SCHEMA_INITIALIZATION_LOCK_TIMEOUT_MS = 5000;

const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_ENVIRONMENT =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_ENVIRONMENT';
const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_LOCK =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_LOCK';
const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SNAPSHOT =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SNAPSHOT';
const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SOURCE_RECHECK =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SOURCE_RECHECK';
const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SHEET_CREATE =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SHEET_CREATE';
const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_GRID_EXPANSION =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_GRID_EXPANSION';
const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_HEADER_WRITE =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_HEADER_WRITE';
const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_POST_WRITE_VERIFY =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_POST_WRITE_VERIFY';
const DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_ROLLBACK =
  'DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_ROLLBACK';

function initializeDevInvoiceSchema() {
  let environment;
  try {
    environment = getEnvironment();
  } catch (error) {
    return createDevInvoiceSchemaInitializationFailure_(
      'DEV_INVOICE_SCHEMA_INITIALIZATION_DEVELOPMENT_REQUIRED',
      DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_ENVIRONMENT
    );
  }
  if (environment !== 'development') {
    return createDevInvoiceSchemaInitializationFailure_(
      'DEV_INVOICE_SCHEMA_INITIALIZATION_DEVELOPMENT_REQUIRED',
      DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_ENVIRONMENT
    );
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(DEV_INVOICE_SCHEMA_INITIALIZATION_LOCK_TIMEOUT_MS)) {
    return createDevInvoiceSchemaInitializationFailure_(
      'DEV_INVOICE_SCHEMA_INITIALIZATION_LOCK_UNAVAILABLE',
      DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_LOCK
    );
  }

  const createdSheets = [];
  let insertedColumnCount = 0;
  let spreadsheet;
  let failurePhase = DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SNAPSHOT;
  try {
    spreadsheet = getSpreadsheet();
    const specifications = getDevInvoiceSchemaInitializationSpecifications_();

    if (!areDevInvoiceSchemaInitializationTargetsAbsent_(spreadsheet, specifications)) {
      return createDevInvoiceSchemaInitializationFailure_(
        'DEV_INVOICE_SCHEMA_INITIALIZATION_TARGET_EXISTS',
        failurePhase
      );
    }

    failurePhase = DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SOURCE_RECHECK;
    if (!areDevInvoiceSchemaInitializationTargetsAbsent_(spreadsheet, specifications)) {
      return createDevInvoiceSchemaInitializationFailure_(
        'DEV_INVOICE_SCHEMA_INITIALIZATION_SOURCE_CHANGED',
        failurePhase
      );
    }

    specifications.forEach(specification => {
      failurePhase = DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_SHEET_CREATE;
      const sheet = spreadsheet.insertSheet(specification.sheetName);
      createdSheets.push(sheet);

      failurePhase = DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_GRID_EXPANSION;
      const missingColumnCount = specification.headers.length - sheet.getMaxColumns();
      if (missingColumnCount > 0) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), missingColumnCount);
        insertedColumnCount += missingColumnCount;
      }

      failurePhase = DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_HEADER_WRITE;
      sheet.getRange(
        specification.headerRowNumber,
        1,
        1,
        specification.headers.length
      ).setValues([specification.headers]);
      specification.sheetId = sheet.getSheetId();
    });

    failurePhase = DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_POST_WRITE_VERIFY;
    const verificationResult = verifyDevInvoiceSchemaInitializationAfterFlush_(
      spreadsheet,
      specifications
    );
    if (verificationResult) {
      throw createDevInvoiceSchemaInitializationFixedError_(verificationResult);
    }

    // actualDataChangeCountは、既存の分析表初期化と同じく出力行の書込み数を表す。
    // シート作成数・追加列数・ヘッダーセル数は別項目で明示する。
    return {
      success: true,
      resultType: 'DEV_INVOICE_SCHEMA_INITIALIZATION_SUCCEEDED',
      initializationVersion: DEV_INVOICE_SCHEMA_INITIALIZATION_VERSION,
      createdSheetCount: specifications.length,
      insertedColumnCount: insertedColumnCount,
      headerRowWriteCount: specifications.length,
      headerCellWriteCount: specifications.reduce(
        (count, specification) => count + specification.headers.length,
        0
      ),
      invoiceColumnCount: specifications[0].headers.length,
      invoiceLineColumnCount: specifications[1].headers.length,
      sourceDataChangeCount: 0,
      actualDataChangeCount: specifications.length,
      actualDataChangeUnit: 'HEADER_ROWS',
      dataChangeState: 'CHANGED'
    };
  } catch (error) {
    const originalFailurePhase = failurePhase;
    const fixedResult = error && error.devInvoiceSchemaInitializationResult;
    let rollbackFailed = false;
    failurePhase = DEV_INVOICE_SCHEMA_INITIALIZATION_PHASE_ROLLBACK;
    createdSheets.reverse().forEach(sheet => {
      try {
        spreadsheet.deleteSheet(sheet);
      } catch (ignored) {
        rollbackFailed = true;
      }
    });
    return createDevInvoiceSchemaInitializationFailure_(
      rollbackFailed
        ? 'DEV_INVOICE_SCHEMA_INITIALIZATION_ROLLBACK_STATE_UNKNOWN'
        : (fixedResult ? fixedResult.resultType : 'DEV_INVOICE_SCHEMA_INITIALIZATION_FAILED'),
      rollbackFailed ? failurePhase : originalFailurePhase,
      rollbackFailed ? null : 0,
      rollbackFailed ? 'UNKNOWN' : 'UNCHANGED'
    );
  } finally {
    lock.releaseLock();
  }
}

function getDevInvoiceSchemaInitializationSpecifications_() {
  return DEV_INVOICE_SCHEMA_INITIALIZATION_TABLE_KEYS.map(tableKey => {
    const table = getCoreSchemaV1Table(tableKey);
    const headers = Object.keys(table.headers).map(headerKey =>
      getCoreSchemaV1HeaderName(tableKey, headerKey)
    );
    if (!table.writeAllowed || table.headerRowNumber !== 1 || headers.length === 0) {
      throw new Error('DEV_INVOICE_SCHEMA_INITIALIZATION_REGISTRY_INVALID');
    }
    if (new Set(headers).size !== headers.length) {
      throw new Error('DEV_INVOICE_SCHEMA_INITIALIZATION_REGISTRY_HEADER_DUPLICATE');
    }
    return {
      tableKey: tableKey,
      sheetName: getCoreSchemaV1TableName(tableKey),
      headerRowNumber: table.headerRowNumber,
      headers: headers,
      sheetId: null
    };
  });
}

function areDevInvoiceSchemaInitializationTargetsAbsent_(spreadsheet, specifications) {
  return specifications.every(specification =>
    spreadsheet.getSheetByName(specification.sheetName) === null
  );
}

function verifyDevInvoiceSchemaInitializationAfterFlush_(spreadsheet, specifications) {
  try {
    SpreadsheetApp.flush();
    for (let index = 0; index < specifications.length; index++) {
      const specification = specifications[index];
      const sheet = spreadsheet.getSheetByName(specification.sheetName);
      if (!sheet || sheet.getSheetId() !== specification.sheetId) {
        return { resultType: 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_SHEET_MISMATCH' };
      }
      if (sheet.getLastRow() !== specification.headerRowNumber) {
        return { resultType: 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_ROW_COUNT_MISMATCH' };
      }
      if (sheet.getLastColumn() !== specification.headers.length) {
        return { resultType: 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_COLUMN_COUNT_MISMATCH' };
      }
      const actualHeaders = sheet.getRange(
        specification.headerRowNumber,
        1,
        1,
        specification.headers.length
      ).getDisplayValues()[0].map(header => String(header).trim());
      if (!areDevInvoiceSchemaInitializationValuesEqual_(actualHeaders, specification.headers)) {
        return { resultType: 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_HEADER_MISMATCH' };
      }
    }
    return null;
  } catch (error) {
    return { resultType: 'DEV_INVOICE_SCHEMA_INITIALIZATION_POST_WRITE_VERIFY_EXCEPTION' };
  }
}

function areDevInvoiceSchemaInitializationValuesEqual_(actual, expected) {
  return actual.length === expected.length && actual.every(
    (value, index) => value === expected[index]
  );
}

function createDevInvoiceSchemaInitializationFixedError_(result) {
  return { devInvoiceSchemaInitializationResult: result };
}

function createDevInvoiceSchemaInitializationFailure_(
  resultType,
  failurePhase,
  actualDataChangeCount,
  dataChangeState
) {
  return {
    success: false,
    resultType: resultType,
    initializationVersion: DEV_INVOICE_SCHEMA_INITIALIZATION_VERSION,
    failurePhase: failurePhase,
    createdSheetCount: 0,
    insertedColumnCount: 0,
    headerRowWriteCount: 0,
    headerCellWriteCount: 0,
    sourceDataChangeCount: 0,
    actualDataChangeCount: actualDataChangeCount === undefined ? 0 : actualDataChangeCount,
    actualDataChangeUnit: 'HEADER_ROWS',
    dataChangeState: dataChangeState || 'UNCHANGED'
  };
}
