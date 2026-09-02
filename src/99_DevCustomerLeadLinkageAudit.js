/**
 * DEV専用: 顧客マスタの source_lead_id → リード管理 紐づき状況と
 *          リード側 contact_method の実データを報告する。
 *
 * 読み取り専用。書き込み処理は一切含まない。
 * 用途: 顧客詳細ページへの連絡手段表示の実現性調査（2026-09-01 PO依頼）
 *
 * @returns {string} JSON.stringify({ ... })
 */
function devCustomerLeadLinkageAudit() {
  if (getEnvironment() !== 'development') {
    throw new Error('devCustomerLeadLinkageAudit は DEV 環境でのみ実行できます');
  }

  var ss = getSpreadsheet();

  // ── 顧客マスタ ───────────────────────────────────────────────────────────
  var custTable  = getCoreSchemaV1Table('CUSTOMERS');
  var custSheet  = getCoreSchemaV1Sheet(ss, 'CUSTOMERS');
  var custIdHeader        = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_ID');
  var sourceLeadIdHeader  = getCoreSchemaV1HeaderName('CUSTOMERS', 'SOURCE_LEAD_ID');

  if (!custSheet || custSheet.getLastRow() <= custTable.headerRowNumber) {
    return JSON.stringify({ error: '顧客マスタにデータがありません' });
  }

  var custData    = custSheet.getDataRange().getValues();
  var custHeaders = custData[custTable.headerRowNumber - 1].map(function(h) { return String(h != null ? h : '').trim(); });
  var custIdIdx   = custHeaders.indexOf(custIdHeader);
  var srcLeadIdx  = custHeaders.indexOf(sourceLeadIdHeader);

  if (custIdIdx < 0)  return JSON.stringify({ error: '顧客マスタに ' + custIdHeader + ' 列がありません' });
  if (srcLeadIdx < 0) return JSON.stringify({ error: '顧客マスタに ' + sourceLeadIdHeader + ' 列がありません' });

  var totalCustomers     = 0;
  var withSourceLeadId   = 0;
  var withoutSourceLeadId = 0;
  var sourceLeadIds      = [];

  for (var r = custTable.headerRowNumber; r < custData.length; r++) {
    var custId   = String(custData[r][custIdIdx]   != null ? custData[r][custIdIdx]   : '').trim();
    var leadIdVal = String(custData[r][srcLeadIdx]  != null ? custData[r][srcLeadIdx]  : '').trim();
    if (!custId) continue;
    totalCustomers++;
    if (leadIdVal) {
      withSourceLeadId++;
      sourceLeadIds.push({ customerId: custId, sourceLeadId: leadIdVal });
    } else {
      withoutSourceLeadId++;
    }
  }

  var sampleSourceLeadIds = sourceLeadIds.slice(0, 10);

  // ── リード管理 ─────────────────────────────────────────────────────────
  var leadsTable  = getCoreSchemaV1Table('LEADS');
  var leadsSheet  = getCoreSchemaV1Sheet(ss, 'LEADS');
  var leadIdHeader     = getCoreSchemaV1HeaderName('LEADS', 'LEAD_ID');
  var contactMethHeader = getCoreSchemaV1HeaderName('LEADS', 'CONTACT_METHOD');

  if (!leadsSheet || leadsSheet.getLastRow() <= leadsTable.headerRowNumber) {
    return JSON.stringify({ error: 'リード管理にデータがありません' });
  }

  var leadsData    = leadsSheet.getDataRange().getValues();
  var leadsHeaders = leadsData[leadsTable.headerRowNumber - 1].map(function(h) { return String(h != null ? h : '').trim(); });
  var leadIdIdx    = leadsHeaders.indexOf(leadIdHeader);
  var contactIdx   = leadsHeaders.indexOf(contactMethHeader);

  if (leadIdIdx < 0) return JSON.stringify({ error: 'リード管理に ' + leadIdHeader + ' 列がありません' });

  // リード管理を lead_id でインデックス化
  var leadsByLeadId = {};
  for (var lr = leadsTable.headerRowNumber; lr < leadsData.length; lr++) {
    var lid = String(leadsData[lr][leadIdIdx] != null ? leadsData[lr][leadIdIdx] : '').trim();
    if (!lid) continue;
    leadsByLeadId[lid] = {
      leadId:        lid,
      contactMethod: contactIdx >= 0 ? String(leadsData[lr][contactIdx] != null ? leadsData[lr][contactIdx] : '').trim() : '（列なし）'
    };
  }

  // 突き合わせ
  var matchedCount   = 0;
  var unmatchedCount = 0;
  var sampleMatched  = [];

  sourceLeadIds.forEach(function(item) {
    var lead = leadsByLeadId[item.sourceLeadId];
    if (lead) {
      matchedCount++;
      if (sampleMatched.length < 10) {
        sampleMatched.push({
          customerId:    item.customerId,
          sourceLeadId:  item.sourceLeadId,
          leadExists:    true,
          contactMethod: lead.contactMethod
        });
      }
    } else {
      unmatchedCount++;
      if (sampleMatched.length < 10) {
        sampleMatched.push({
          customerId:    item.customerId,
          sourceLeadId:  item.sourceLeadId,
          leadExists:    false,
          contactMethod: null
        });
      }
    }
  });

  // contact_method の値分布（全マッチ行）
  var contactMethodDist = {};
  sourceLeadIds.forEach(function(item) {
    var lead = leadsByLeadId[item.sourceLeadId];
    if (!lead) return;
    var cm = lead.contactMethod || '（空）';
    contactMethodDist[cm] = (contactMethodDist[cm] || 0) + 1;
  });

  return JSON.stringify({
    customerMaster: {
      totalCustomers:       totalCustomers,
      withSourceLeadId:     withSourceLeadId,
      withoutSourceLeadId:  withoutSourceLeadId,
      sampleSourceLeadIds:  sampleSourceLeadIds
    },
    leadLinkage: {
      matchedCount:    matchedCount,
      unmatchedCount:  unmatchedCount,
      contactMethodColumnExists: contactIdx >= 0,
      contactMethodHeaderName:   contactIdx >= 0 ? contactMethHeader : null
    },
    contactMethodDistribution: contactMethodDist,
    sampleMatched: sampleMatched
  });
}
