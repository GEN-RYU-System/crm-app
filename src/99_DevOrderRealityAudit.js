/**
 * DEVのオーダー実態を、参照証拠の件数だけで監査する。
 * ID、日付、URL、金額、ステータス値、その他のセル値は返却・記録しない。
 */
const DEV_ORDER_REALITY_AUDIT_VERSION = '2';
const DEV_ORDER_REALITY_AUDIT_SCHEMA_INVALID = 'ORDER_REALITY_AUDIT_SCHEMA_INVALID';
const DEV_ORDER_REALITY_AUDIT_FAILED = 'ORDER_REALITY_AUDIT_FAILED';
const DEV_ORDER_REALITY_AUDIT_ORDER_SCHEMA = {
  sheet: 'オーダー管理',
  headers: ['オーダーID', 'ステータス', '受注日', '請求書番号', '請求書リンク', '請求書発行日', '支払確認日', '発送日']
};
const DEV_ORDER_REALITY_AUDIT_SHIPMENT_SCHEMA = {
  sheet: '発送', headers: ['order_id', 'shipped_at']
};
const DEV_ORDER_REALITY_AUDIT_PURCHASE_SCHEMA = {
  sheet: '仕入れ', headers: ['オーダーID']
};
const DEV_ORDER_REALITY_AUDIT_STATUS_GROUPS = {
  orderReceived: '受注',
  processing: '処理中',
  shipped: '発送済み',
  completed: '完了',
  cancelled: 'キャンセル'
};
const DEV_ORDER_REALITY_AUDIT_BLANK_DATE_EVIDENCE = [
  ['invoiceNumberRecorded'],
  ['invoiceLinkRecorded'],
  ['invoiceIssueDateValid'],
  ['paymentConfirmedDateValid'],
  ['orderShippingDateValid'],
  ['shipmentRecordPresent'],
  ['shipmentDateValid'],
  ['purchaseRecordPresent']
];
const DEV_ORDER_REALITY_AUDIT_ALL_ORDER_EVIDENCE = [
  ['invoiceNumberRecorded'],
  ['invoiceLinkRecorded'],
  ['invoiceIssueDateValid'],
  ['paymentConfirmedDateValid'],
  ['orderShippingDateValid'],
  ['shipmentRecordPresent'],
  ['shipmentDateValid'],
  ['purchaseRecordPresent']
];

function auditDevOrderReality() {
  if (getEnvironment() !== 'development') {
    throw new Error('auditDevOrderReality is available only in development');
  }
  try {
    return buildDevOrderRealityAudit(getSpreadsheet());
  } catch (error) {
    return {
      success: false,
      resultType: isDevOrderRealitySchemaError(error)
        ? DEV_ORDER_REALITY_AUDIT_SCHEMA_INVALID
        : DEV_ORDER_REALITY_AUDIT_FAILED,
      auditVersion: DEV_ORDER_REALITY_AUDIT_VERSION,
      actualDataChangeCount: 0
    };
  }
}

function buildDevOrderRealityAudit(spreadsheet) {
  const orders = readDevOrderRealityAuditSheet(spreadsheet, DEV_ORDER_REALITY_AUDIT_ORDER_SCHEMA);
  const shipments = readDevOrderRealityAuditSheet(
    spreadsheet, DEV_ORDER_REALITY_AUDIT_SHIPMENT_SCHEMA
  );
  const purchases = readDevOrderRealityAuditSheet(
    spreadsheet, DEV_ORDER_REALITY_AUDIT_PURCHASE_SCHEMA
  );
  const shipmentEvidence = getDevOrderRealityShipmentEvidence(shipments);
  const purchaseOrderIds = getDevOrderRealityIds(purchases, 'オーダーID');
  const orderRows = orders.rows.filter(row => !isDevOrderRealityEmpty(
    getDevOrderRealityValue(orders, row, 'オーダーID')
  ));
  const evidenceRows = orderRows.map(row => createDevOrderRealityEvidence(
    orders, row, shipmentEvidence, purchaseOrderIds
  ));
  return {
    success: true,
    resultType: 'ORDER_REALITY_AUDIT_COMPLETED',
    auditVersion: DEV_ORDER_REALITY_AUDIT_VERSION,
    actualDataChangeCount: 0,
    blankOrderDateEvidence: auditDevOrderRealityBlankDateEvidence(evidenceRows),
    allOrderStatusAndEvidence: auditDevOrderRealityAllOrderEvidence(evidenceRows)
  };
}

function readDevOrderRealityAuditSheet(spreadsheet, schema) {
  const sheet = spreadsheet.getSheetByName(schema.sheet);
  if (!sheet || sheet.getLastColumn() < 1 || sheet.getLastRow() < 1) {
    throw new Error(DEV_ORDER_REALITY_AUDIT_SCHEMA_INVALID);
  }
  const lastColumn = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const indexes = getDevOrderRealityHeaderIndexes(headers);
  schema.headers.forEach(header => requireDevOrderRealityHeader(indexes, header));
  const range = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn) : null;
  const values = range ? range.getValues() : [];
  const formulas = range ? range.getFormulas() : [];
  return {
    indexes: indexes,
    rows: values.reduce((result, row, index) => {
      if (isDevOrderRealityRecord(row, formulas[index])) result.push(row);
      return result;
    }, [])
  };
}

function getDevOrderRealityHeaderIndexes(headers) {
  const indexes = {};
  headers.forEach((header, index) => {
    const normalized = String(header).trim();
    if (!normalized) return;
    if (Object.prototype.hasOwnProperty.call(indexes, normalized)) {
      throw new Error(DEV_ORDER_REALITY_AUDIT_SCHEMA_INVALID);
    }
    indexes[normalized] = index;
  });
  return indexes;
}

function requireDevOrderRealityHeader(indexes, header) {
  if (!Object.prototype.hasOwnProperty.call(indexes, header)) {
    throw new Error(DEV_ORDER_REALITY_AUDIT_SCHEMA_INVALID);
  }
  return indexes[header];
}

function getDevOrderRealityValue(data, row, header) {
  return row[requireDevOrderRealityHeader(data.indexes, header)];
}

function isDevOrderRealityRecord(row, formulas) {
  return row.some((value, index) =>
    !isDevOrderRealityEmpty(value) || !isDevOrderRealityEmpty(formulas[index])
  );
}

function getDevOrderRealityIds(data, header) {
  return new Set(data.rows.reduce((result, row) => {
    const value = getDevOrderRealityValue(data, row, header);
    if (!isDevOrderRealityEmpty(value)) result.push(String(value));
    return result;
  }, []));
}

function getDevOrderRealityShipmentEvidence(shipments) {
  const shipmentOrderIds = new Set();
  const shipmentDateStatesByOrderId = {};
  shipments.rows.forEach(row => {
    const orderId = getDevOrderRealityValue(shipments, row, 'order_id');
    if (isDevOrderRealityEmpty(orderId)) return;
    const normalizedOrderId = String(orderId);
    shipmentOrderIds.add(normalizedOrderId);
    const state = getDevOrderRealityDateState(getDevOrderRealityValue(shipments, row, 'shipped_at'));
    const states = shipmentDateStatesByOrderId[normalizedOrderId] || { valid: false, invalid: false };
    states.valid = states.valid || state === 'valid';
    states.invalid = states.invalid || state === 'invalid';
    shipmentDateStatesByOrderId[normalizedOrderId] = states;
  });
  return { shipmentOrderIds: shipmentOrderIds, shipmentDateStatesByOrderId: shipmentDateStatesByOrderId };
}

function getDevOrderRealityShipmentDateState(shipmentEvidence, orderId) {
  const states = shipmentEvidence.shipmentDateStatesByOrderId[orderId];
  if (!states) return 'empty';
  if (states.valid) return 'valid';
  return states.invalid ? 'invalid' : 'empty';
}

function createDevOrderRealityEvidence(orders, row, shipmentEvidence, purchaseOrderIds) {
  const orderId = String(getDevOrderRealityValue(orders, row, 'オーダーID'));
  const status = getDevOrderRealityValue(orders, row, 'ステータス');
  return {
    orderDateEmpty: isDevOrderRealityEmpty(getDevOrderRealityValue(orders, row, '受注日')),
    statusGroup: getDevOrderRealityStatusGroup(status),
    invoiceNumberRecorded: !isDevOrderRealityEmpty(getDevOrderRealityValue(orders, row, '請求書番号')),
    invoiceLinkRecorded: !isDevOrderRealityEmpty(getDevOrderRealityValue(orders, row, '請求書リンク')),
    invoiceIssueDateState: getDevOrderRealityDateState(
      getDevOrderRealityValue(orders, row, '請求書発行日')
    ),
    paymentConfirmedDateState: getDevOrderRealityDateState(
      getDevOrderRealityValue(orders, row, '支払確認日')
    ),
    orderShippingDateState: getDevOrderRealityDateState(
      getDevOrderRealityValue(orders, row, '発送日')
    ),
    shipmentRecordPresent: shipmentEvidence.shipmentOrderIds.has(orderId),
    shipmentDateState: getDevOrderRealityShipmentDateState(shipmentEvidence, orderId),
    purchaseRecordPresent: purchaseOrderIds.has(orderId)
  };
}

function getDevOrderRealityDateState(value) {
  if (isDevOrderRealityEmpty(value)) return 'empty';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? 'invalid' : 'valid';
  }
  if (typeof value !== 'string') return 'invalid';
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return 'invalid';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day ? 'valid' : 'invalid';
}

function getDevOrderRealityStatusGroup(status) {
  if (isDevOrderRealityEmpty(status) || String(status).trim() === '') return 'empty';
  const normalized = String(status).trim();
  const matched = Object.keys(DEV_ORDER_REALITY_AUDIT_STATUS_GROUPS).find(key =>
    DEV_ORDER_REALITY_AUDIT_STATUS_GROUPS[key] === normalized
  );
  return matched || 'other';
}

function auditDevOrderRealityBlankDateEvidence(evidenceRows) {
  const rows = evidenceRows.filter(row => row.orderDateEmpty);
  const counts = createDevOrderRealityEvidenceCounts(
    rows, DEV_ORDER_REALITY_AUDIT_BLANK_DATE_EVIDENCE
  );
  return Object.assign(
    { blankOrderDateOrderCount: rows.length },
    createDevOrderRealityDateStateCounts(rows),
    counts
  );
}

function auditDevOrderRealityAllOrderEvidence(evidenceRows) {
  const statusCounts = {
    orderReceivedCount: 0,
    processingCount: 0,
    shippedCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    emptyStatusCount: 0,
    otherStatusCount: 0
  };
  evidenceRows.forEach(row => {
    const key = {
      orderReceived: 'orderReceivedCount', processing: 'processingCount', shipped: 'shippedCount',
      completed: 'completedCount', cancelled: 'cancelledCount', empty: 'emptyStatusCount', other: 'otherStatusCount'
    }[row.statusGroup];
    statusCounts[key] += 1;
  });
  const counts = createDevOrderRealityEvidenceCounts(
    evidenceRows, DEV_ORDER_REALITY_AUDIT_ALL_ORDER_EVIDENCE
  );
  return Object.assign(
    { orderRecordCount: evidenceRows.length },
    statusCounts,
    createDevOrderRealityDateStateCounts(evidenceRows),
    counts
  );
}

function createDevOrderRealityDateStateCounts(rows) {
  const definitions = [
    ['invoiceIssueDate', 'invoiceIssueDateState'],
    ['paymentConfirmedDate', 'paymentConfirmedDateState'],
    ['orderShippingDate', 'orderShippingDateState'],
    ['shipmentDate', 'shipmentDateState']
  ];
  return definitions.reduce((result, definition) => {
    ['valid', 'empty', 'invalid'].forEach(state => {
      result[definition[0] + state.charAt(0).toUpperCase() + state.slice(1) + 'Count'] =
        rows.filter(row => row[definition[1]] === state).length;
    });
    return result;
  }, {});
}

function createDevOrderRealityEvidenceCounts(rows, evidenceDefinitions) {
  const presentCounts = {};
  evidenceDefinitions.forEach(definition => { presentCounts[definition[0] + 'Count'] = 0; });
  const combinations = {};
  rows.forEach(row => {
    const combination = evidenceDefinitions.filter(definition =>
      definition[0].endsWith('Valid')
        ? row[definition[0].slice(0, -5) + 'State'] === 'valid'
        : row[definition[0]]
    )
      .map(definition => definition[0]).join('|') || 'NONE';
    combinations[combination] = (combinations[combination] || 0) + 1;
    evidenceDefinitions.forEach(definition => {
      const isPresent = definition[0].endsWith('Valid')
        ? row[definition[0].slice(0, -5) + 'State'] === 'valid'
        : row[definition[0]];
      if (isPresent) presentCounts[definition[0] + 'Count'] += 1;
    });
  });
  return Object.assign(presentCounts, { evidenceCombinationCounts: combinations });
}

function isDevOrderRealityEmpty(value) {
  return value === '' || value === null || typeof value === 'undefined' ||
    (typeof value === 'string' && value.trim() === '');
}

function isDevOrderRealitySchemaError(error) {
  return error && error.message === DEV_ORDER_REALITY_AUDIT_SCHEMA_INVALID;
}
