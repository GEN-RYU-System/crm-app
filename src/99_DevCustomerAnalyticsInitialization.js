const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS = ['顧客分析', '顧客月次分析', '顧客購入商品分析'];
const DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED = {
  customerAnalyticsRowCount: 51, customerMonthlyAnalyticsRowCount: 69, customerProductAnalyticsRowCount: 262,
  orderDateEmptyCount: 8, totalOrderAmount: 80139404.5, cancelledOrderAmount: 28776519,
  completedOrderAmount: 47155185.5, unconfirmedOrderAmount: 4207700
};

function initializeDevCustomerAnalytics() {
  if (getEnvironment() !== 'development') throw new Error('initializeDevCustomerAnalytics is available only in development');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, resultType: 'INITIALIZATION_LOCK_UNAVAILABLE', actualDataChangeCount: 0 };
  const created = [];
  let ss;
  try {
    ss = getSpreadsheet();
    if (DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS.some(name => ss.getSheetByName(name))) {
      return { success: false, resultType: 'INITIALIZATION_TARGET_EXISTS', actualDataChangeCount: 0 };
    }
    const audit = buildDevCustomerAnalyticsMaterializationDryRun(ss);
    if (!audit.success || !Object.keys(DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED).every(key => audit[key] === DEV_CUSTOMER_ANALYTICS_INITIALIZATION_EXPECTED[key])) {
      return { success: false, resultType: 'INITIALIZATION_EXPECTATION_MISMATCH', actualDataChangeCount: 0 };
    }
    const tables = buildDevCustomerAnalyticsInitializationTables(ss);
    if (tables.customer.length !== 51 || tables.monthly.length !== 69 || tables.product.length !== 262) {
      return { success: false, resultType: 'INITIALIZATION_TABLE_COUNT_MISMATCH', actualDataChangeCount: 0 };
    }
    const specifications = [
      [DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS[0], ['顧客ID','初回受注日','初回取引完了日','累計総受注数','累計総受注額','累計キャンセル数','累計キャンセル額','累計完了数','累計完了額','累計未確定数','累計未確定額','受注日未設定注文数'], tables.customer, [2, 3]],
      [DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS[1], ['顧客ID','受注年月','総受注数','総受注額','キャンセル数','キャンセル額','完了数','完了額','未確定数','未確定額'], tables.monthly, []],
      [DEV_CUSTOMER_ANALYTICS_INITIALIZATION_SHEETS[2], ['顧客ID','商品ID','購入明細行数','購入注文数','キャンセル明細行数','完了明細行数','未確定明細行数'], tables.product, []]
    ];
    specifications.forEach(spec => {
      const sh = ss.insertSheet(spec[0]);
      created.push(sh);
      sh.getRange(1, 1, 1, spec[1].length).setValues([spec[1]]);
      sh.getRange(2, 1, spec[2].length, spec[1].length).setValues(spec[2]);
      spec[3].forEach(column => sh.getRange(2, column, spec[2].length, 1).setNumberFormat('yyyy-MM-dd'));
    });
    return { success: true, resultType: 'INITIALIZATION_SUCCEEDED', actualDataChangeCount: 0, customerAnalyticsRowCount: 51, customerMonthlyAnalyticsRowCount: 69, customerProductAnalyticsRowCount: 262 };
  } catch (e) {
    let rollbackFailed = false;
    created.reverse().forEach(sh => {
      try { ss.deleteSheet(sh); } catch (ignored) { rollbackFailed = true; }
    });
    return {
      success: false,
      resultType: rollbackFailed ? 'INITIALIZATION_ROLLBACK_STATE_UNKNOWN' : 'INITIALIZATION_FAILED',
      actualDataChangeCount: rollbackFailed ? null : 0,
      dataChangeState: rollbackFailed ? 'UNKNOWN' : 'UNCHANGED'
    };
  } finally { lock.releaseLock(); }
}

function buildDevCustomerAnalyticsInitializationTables(ss) {
  const d={}; Object.keys(DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMAS).forEach(k=>d[k]=readDevCustomerAnalyticsMaterializationSheet(ss,DEV_CUSTOMER_ANALYTICS_MATERIALIZATION_SCHEMAS[k]));
  const customers={}; d.customers.rows.forEach(r=>{const id=String(getDevCustomerAnalyticsMaterializationValue(d.customers,r,'顧客ID')); if(id) customers[id]={id:id,first:'',firstCompleted:'',empty:0,cancelled:[0,0],completed:[0,0],unconfirmed:[0,0]};});
  const orders={}; const monthly={};
  const spreadsheetTimeZone = ss.getSpreadsheetTimeZone();
  d.orders.rows.forEach(r=>{const id=String(getDevCustomerAnalyticsMaterializationValue(d.orders,r,'オーダーID')); const cid=String(getDevCustomerAnalyticsMaterializationValue(d.orders,r,'顧客ID')); const c=customers[cid]; if(!id||!c)return; const kind=getDevCustomerAnalyticsMaterializationClassification(getDevCustomerAnalyticsMaterializationValue(d.orders,r,'ステータス')); const date=getDevCustomerAnalyticsMaterializationDateState(getDevCustomerAnalyticsMaterializationValue(d.orders,r,'受注日'),spreadsheetTimeZone); const amount=getDevCustomerAnalyticsMaterializationNumberState(getDevCustomerAnalyticsMaterializationValue(d.orders,r,'請求総額')); const v=amount.state==='valid'?amount.value:0; c[kind][0]++; c[kind][1]+=v; if(date.state==='empty')c.empty++; if(date.state==='valid'){const key=cid+'|'+date.yearMonth; const m=monthly[key]||(monthly[key]={cid:cid,ym:date.yearMonth,cancelled:[0,0],completed:[0,0],unconfirmed:[0,0]});m[kind][0]++;m[kind][1]+=v;if(!c.first||date.date.getTime()<c.first.getTime())c.first=date.date;if(kind==='completed'&&(!c.firstCompleted||date.date.getTime()<c.firstCompleted.getTime()))c.firstCompleted=date.date;} orders[id]={cid:cid,kind:kind};});
  const product={}; d.lines.rows.forEach(r=>{const o=orders[String(getDevCustomerAnalyticsMaterializationValue(d.lines,r,'オーダーID'))];const pid=String(getDevCustomerAnalyticsMaterializationValue(d.lines,r,'商品ID'));if(!o||!pid)return;const key=o.cid+'|'+pid;const p=product[key]||(product[key]={cid:o.cid,pid:pid,orders:{},cancelled:0,completed:0,unconfirmed:0,lines:0});p.lines++;p.orders[String(getDevCustomerAnalyticsMaterializationValue(d.lines,r,'オーダーID'))]=true;p[o.kind]++;});
  return {customer:Object.keys(customers).sort().map(k=>{const c=customers[k];return [c.id,c.first,c.firstCompleted,c.cancelled[0]+c.completed[0]+c.unconfirmed[0],c.cancelled[1]+c.completed[1]+c.unconfirmed[1],c.cancelled[0],c.cancelled[1],c.completed[0],c.completed[1],c.unconfirmed[0],c.unconfirmed[1],c.empty];}),monthly:Object.keys(monthly).sort().map(k=>{const m=monthly[k];return [m.cid,m.ym,m.cancelled[0]+m.completed[0]+m.unconfirmed[0],m.cancelled[1]+m.completed[1]+m.unconfirmed[1],m.cancelled[0],m.cancelled[1],m.completed[0],m.completed[1],m.unconfirmed[0],m.unconfirmed[1]];}),product:Object.keys(product).sort().map(k=>{const p=product[k];return [p.cid,p.pid,p.lines,Object.keys(p.orders).length,p.cancelled,p.completed,p.unconfirmed];})};
}
