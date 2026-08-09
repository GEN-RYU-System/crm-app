/**
 * フォーム受け口: registerCustomerFromForm(payload)
 * PR18: form-intake
 *
 * payload 契約:
 * {
 *   token: string,
 *   billing:  { name, phone, email, taxId, addr1, addr2, addr3, city, state, zip, country },
 *   shipping: { ...同構成 } | null   ← null = billing と同一住所
 * }
 *
 * 返り値:
 * {
 *   success:    boolean,
 *   customerId: string | null,
 *   addrId:     string | null,   // 配送先ID
 *   payId:      string | null,   // 支払先ID
 *   warnings:   string[],        // 要確認リスト（normalizePhone フラグ等）
 *   errors:     string[]         // 全バリデーションエラー（失敗時）
 * }
 */

var FORM_TOKEN_SHEET   = 'フォームトークン';
var FORM_TOKEN_HEADERS = ['トークン', 'リードID', '発行日', '使用日'];

// ============================================================
// 1. フォームトークンタブ管理
// ============================================================

/**
 * フォームトークンタブを新設（冪等）
 * @returns {string}
 */
function seedFormTokenTab() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(FORM_TOKEN_SHEET);
  if (!sh) {
    sh = ss.insertSheet(FORM_TOKEN_SHEET);
  } else if (sh.getLastRow() >= 1) {
    return FORM_TOKEN_SHEET + ': 既存（スキップ）';
  }
  var hRange = sh.getRange(1, 1, 1, FORM_TOKEN_HEADERS.length);
  hRange.setValues([FORM_TOKEN_HEADERS]);
  hRange.setFontWeight('bold').setBackground('#1565c0').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 280);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 100);
  sh.setColumnWidth(4, 100);
  return FORM_TOKEN_SHEET + ': 作成完了';
}

/**
 * 指定リードIDに紐付くトークンを発行してシートに記録
 * @param {string} leadId
 * @returns {string} 発行トークン（UUID）
 */
function issueFormToken(leadId) {
  if (!leadId) throw new Error('issueFormToken: leadId が空です');
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(FORM_TOKEN_SHEET);
  if (!sh) {
    seedFormTokenTab();
    sh = ss.getSheetByName(FORM_TOKEN_SHEET);
  }
  var token = Utilities.getUuid();
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
  sh.appendRow([token, leadId, today, '']);
  return token;
}

// ============================================================
// 2. バリデーションヘルパー
// ============================================================

/**
 * 国マスタから州必須・郵便番号必須を取得
 * @param {string} countryName - 国名（表示）
 * @returns {{stateRequired: boolean, postalRequired: boolean} | null}
 */
function _lookupCountryInfo(countryName) {
  var ss  = getSpreadsheet();
  var sh  = ss.getSheetByName('国マスタ');
  if (!sh) return null;
  var data = sh.getDataRange().getValues();
  var h    = data[0];
  var nameIdx   = h.indexOf('国名（表示）');
  var stateIdx  = h.indexOf('州必須');
  var postalIdx = h.indexOf('郵便番号必須');
  if (nameIdx < 0) return null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][nameIdx]).trim() === String(countryName).trim()) {
      return {
        stateRequired:  stateIdx  >= 0 && String(data[i][stateIdx]).toUpperCase()  === 'TRUE',
        postalRequired: postalIdx >= 0 && String(data[i][postalIdx]).toUpperCase() === 'TRUE'
      };
    }
  }
  return null;  // 国マスタに該当なし
}

var _ADDR_CHARSET = /^[A-Za-z0-9\s,.\-#\/']*$/;

/**
 * 住所ブロックのサーバー検証（エラーを errors 配列に追加）
 * @param {Object}  block       - payload.billing or payload.shipping
 * @param {string}  label       - '請求先' or '配送先'
 * @param {boolean} requireEmail
 * @param {Array}   errors      - 出力先
 */
function _validateBlock(block, label, requireEmail, errors) {
  var b = block || {};
  function str(v) { return String(v || '').trim(); }

  // 必須: name / phone / addr1 / city / country
  ['name', 'phone', 'addr1', 'city', 'country'].forEach(function(f) {
    if (!str(b[f])) errors.push('[' + label + '] ' + f + ' は必須です');
  });
  if (requireEmail && !str(b.email)) {
    errors.push('[' + label + '] email は必須です');
  }

  // 国マスタ参照（country が空でも先へ進む）
  var countryInfo = str(b.country) ? _lookupCountryInfo(str(b.country)) : null;

  if (str(b.country) && !countryInfo) {
    errors.push('[' + label + '] country "' + str(b.country) + '" が国マスタに存在しません');
  }
  if (countryInfo && countryInfo.stateRequired && !str(b.state)) {
    errors.push('[' + label + '] ' + str(b.country) + ' は State（州）が必須です');
  }
  if (countryInfo && countryInfo.postalRequired && !str(b.zip)) {
    errors.push('[' + label + '] ' + str(b.country) + ' は Zip（郵便番号）が必須です');
  }

  // 35字制限
  ['addr1', 'addr2', 'addr3', 'city', 'state'].forEach(function(f) {
    var v = str(b[f]);
    if (v.length > 35) {
      errors.push('[' + label + '] ' + f + ' は35字以内にしてください（現在' + v.length + '字）: "' + v + '"');
    }
  });

  // 文字種（住所フィールドのみ）
  ['addr1', 'addr2', 'addr3', 'city', 'state'].forEach(function(f) {
    var v = str(b[f]);
    if (v && !_ADDR_CHARSET.test(v)) {
      errors.push('[' + label + '] ' + f + ' に許容外文字が含まれています: "' + v + '"');
    }
  });
}

// ============================================================
// 3. 採番ヘルパー
// ============================================================

function _nextId(sh, colName, prefix, digits) {
  var data = sh.getDataRange().getValues();
  var h    = data[0];
  var idx  = h.indexOf(colName);
  if (idx < 0) throw new Error(colName + ' 列が見つかりません');
  var max = 0;
  var re  = new RegExp('^' + prefix + '(\\d+)$');
  data.slice(1).forEach(function(r) {
    var m = String(r[idx] || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return prefix + String(max + 1).padStart(digits || 5, '0');
}

// ============================================================
// 4. メイン関数
// ============================================================

/**
 * フォームからの顧客登録
 * @param {Object} payload
 * @returns {Object} {success, customerId, addrId, payId, warnings, errors}
 */
function registerCustomerFromForm(payload) {
  function ok(customerId, addrId, payId, warnings) {
    return { success: true,  customerId: customerId, addrId: addrId, payId: payId,
             warnings: warnings || [], errors: [] };
  }
  function ng(errors, warnings) {
    return { success: false, customerId: null, addrId: null, payId: null,
             warnings: warnings || [], errors: errors || [] };
  }

  // --- 0. payload パース ---
  var token    = String((payload || {}).token || '').trim();
  var billing  = (payload || {}).billing  || {};
  var shipping = (payload || {}).shipping || null;
  var shipBlock = shipping || billing;  // null の場合は billing と同一

  if (!token) return ng(['token が空です']);

  var ss = getSpreadsheet();

  // --- 1. トークン検証（ロック外で先行チェック）---
  var tokSh = ss.getSheetByName(FORM_TOKEN_SHEET);
  if (!tokSh) return ng(['フォームトークンタブが存在しません。seedFormTokenTab() を実行してください。']);

  var tokData   = tokSh.getDataRange().getValues();
  var tokH      = tokData[0];
  var tokTokIdx = tokH.indexOf('トークン');
  var tokLidIdx = tokH.indexOf('リードID');
  var tokUseIdx = tokH.indexOf('使用日');
  if (tokTokIdx < 0 || tokLidIdx < 0 || tokUseIdx < 0) {
    return ng(['フォームトークンタブのヘッダーが不正です']);
  }

  var tokRowIdx = -1;  // シートの 1始まり行番号
  var leadId    = '';
  for (var i = 1; i < tokData.length; i++) {
    if (String(tokData[i][tokTokIdx]).trim() === token) {
      tokRowIdx = i + 1;
      leadId    = String(tokData[i][tokLidIdx] || '').trim();
      var usedDate = String(tokData[i][tokUseIdx] || '').trim();
      if (usedDate) return ng(['このトークンは既に使用済みです（使用日: ' + usedDate + '）']);
      break;
    }
  }
  if (tokRowIdx < 0) return ng(['トークンが無効です（フォームトークンタブに存在しません）']);
  if (!leadId)       return ng(['トークンにリードIDが紐付いていません']);

  // --- 2. LockService 排他取得 ---
  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    lock.waitLock(5000);
    acquired = true;
  } catch (e) {
    return ng(['サーバーが混雑しています。しばらくしてから再試行してください。']);
  }

  try {
    // --- 2a. ロック下で使用済み再チェック（二重送信ガード）---
    var tokDataLocked = tokSh.getDataRange().getValues();
    var usedDateLocked = String((tokDataLocked[tokRowIdx - 1] || [])[tokUseIdx] || '').trim();
    if (usedDateLocked) {
      return ng(['このトークンは既に使用済みです（二重送信ガード）']);
    }

    // --- 3. バリデーション（全件収集）---
    var errors = [];
    _validateBlock(billing,  '請求先', true,  errors);
    if (shipping !== null) {
      _validateBlock(shipping, '配送先', false, errors);
    }
    if (errors.length > 0) return ng(errors);

    // --- 4. normalizePhone 適用 ---
    var warnings = [];
    var bPhone = billing.phone  ? normalizePhone(billing.country,  billing.phone)  : { value: '', flag: '空欄' };
    var sPhone = shipBlock.phone ? normalizePhone(shipBlock.country, shipBlock.phone) : { value: '', flag: '空欄' };
    if (bPhone.flag !== '✓' && bPhone.flag !== '空欄') {
      warnings.push('請求先 phone: ' + bPhone.flag + ' → "' + bPhone.value + '"');
    }
    if (shipping !== null && sPhone.flag !== '✓' && sPhone.flag !== '空欄') {
      warnings.push('配送先 phone: ' + sPhone.flag + ' → "' + sPhone.value + '"');
    }

    // --- 5. シート取得 ---
    var custSh = ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS);
    var adSh   = ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING);
    var pySh   = ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT);
    if (!custSh || !adSh || !pySh) return ng(['必須シートが存在しません: ' + CONFIG.SHEETS.CRM_CUSTOMERS]);

    // --- 6. 重複ガード（同一源流リードIDの顧客が既存か）---
    var custData  = custSh.getDataRange().getValues();
    var custH     = custData[0];
    var custCidIdx = custH.indexOf('顧客ID');
    var custSrcIdx = custH.indexOf('源流リードID');
    var existingCustId = null;

    for (var c = 1; c < custData.length; c++) {
      if (String(custData[c][custSrcIdx] || '').trim() === leadId) {
        existingCustId = String(custData[c][custCidIdx] || '').trim();
        break;
      }
    }

    var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
    var customerId;
    var isNew = !existingCustId;

    // --- 7. 採番 ---
    customerId = isNew ? _nextId(custSh, '顧客ID',   'CT-', 5) : existingCustId;
    var addrId = _nextId(adSh,  '配送先ID', 'AD-', 5);
    var payId  = _nextId(pySh,  '支払先ID', 'PY-', 5);

    // --- 8. 書き込み ---
    var defaultFlag = isNew ? 'TRUE' : 'FALSE';  // 2枚目以降は FALSE

    // 8a. 顧客マスタ（新規のみ）
    if (isNew) {
      var custRow = [
        customerId,         // 顧客ID
        leadId,             // 源流リードID
        billing.name,       // 顧客名
        billing.country,    // 国
        billing.email,      // メール
        bPhone.value || billing.phone, // 電話番号（正規化済）
        '',                 // 初回取引日
        today,              // 登録日
        '',                 // 営業担当者
        '',                 // 連絡ツール
        '',                 // FedEx ID
        '',                 // 発送時メモ
        '',                 // Discord参加
        '',                 // Discord チャンネルID
        '',                 // Discord ユーザーID
        '',                 // Discrod 請求書 webhook
        '',                 // Discrod 発送通知 webhook
        ''                  // Shippment webhook
      ];
      custSh.appendRow(custRow);
    }

    // 8b. 配送先マスタ
    var sb = shipBlock;
    var shipRow = [
      addrId,                         // 配送先ID
      customerId,                     // 顧客ID
      sb.name,                        // 宛名
      sb.addr1 || '',                 // Address 1
      sb.addr2 || '',                 // Address 2
      sb.addr3 || '',                 // Address 3
      sb.city  || '',                 // City
      sb.state || '',                 // State
      sb.zip   || '',                 // Zip
      sb.country || '',               // 国
      sPhone.value || sb.phone || '', // 電話
      sb.email || billing.email || '',// D Email
      sb.taxId || '',                 // D Tax ID
      defaultFlag,                    // 既定
      'TRUE'                          // 有効
    ];
    adSh.appendRow(shipRow);

    // 8c. 支払先マスタ
    var bb = billing;
    var payRow = [
      payId,                          // 支払先ID
      customerId,                     // 顧客ID
      bb.name,                        // 請求名義
      bb.addr1 || '',                 // Address 1
      bb.addr2 || '',                 // Address 2
      bb.addr3 || '',                 // Address 3
      bb.city  || '',                 // City
      bb.state || '',                 // State
      bb.zip   || '',                 // Zip
      bb.country || '',               // 国
      '',                             // 支払方法
      '',                             // 通貨
      bb.taxId || '',                 // B Tax ID
      defaultFlag,                    // 既定
      'TRUE'                          // 有効
    ];
    pySh.appendRow(payRow);

    // --- 9. トークン使用日を記録 ---
    tokSh.getRange(tokRowIdx, tokUseIdx + 1).setValue(today);

    return ok(customerId, addrId, payId, warnings);

  } finally {
    if (acquired) lock.releaseLock();
  }
}

// ============================================================
// 5. テスト（4シナリオ）
// ============================================================

/**
 * registerCustomerFromForm の 4シナリオ機械検証
 * 実行後にテストデータを自動クリーンアップ
 * @returns {string} 実行ログ
 */
function testRegisterCustomer() {
  var ss    = getSpreadsheet();
  var lines = ['=== testRegisterCustomer ==='];
  var pass  = 0, fail = 0;

  // フォームトークンタブ確認
  if (!ss.getSheetByName(FORM_TOKEN_SHEET)) {
    lines.push('フォームトークンタブを作成します...');
    lines.push(seedFormTokenTab());
  }

  // テスト用リードID（リード管理から最初の有効行を取得）
  var leadSh   = ss.getSheetByName(CONFIG.SHEETS.LEADS);
  if (!leadSh) return '=== testRegisterCustomer ===\nERROR: リード管理シートが存在しません';
  var leadData = leadSh.getDataRange().getValues();
  var lh       = leadData[0];
  var lidIdx   = lh.indexOf('リードID');
  var testLeadId = null;
  for (var li = 1; li < leadData.length; li++) {
    var lid = String(leadData[li][lidIdx] || '').trim();
    if (lid) { testLeadId = lid; break; }
  }
  if (!testLeadId) return '=== testRegisterCustomer ===\nERROR: リード管理にデータがありません';
  lines.push('テスト用リードID: ' + testLeadId);

  // トークン発行（シナリオ1・2・4 用）
  var token1 = issueFormToken(testLeadId);
  var token2 = issueFormToken(testLeadId);
  var token4 = issueFormToken(testLeadId);
  lines.push('発行トークン: token1=' + token1.substring(0, 8) + '...' +
             ', token2=' + token2.substring(0, 8) + '...' +
             ', token4=' + token4.substring(0, 8) + '...');
  lines.push('');

  var testCustomerId = null;
  var testAddrIds    = [];
  var testPayIds     = [];

  // ---- シナリオ1: 新規登録 ----
  var p1 = {
    token: token1,
    billing: {
      name: 'TEST Customer PR18', phone: '0312345678',
      email: 'test.pr18@example.com', taxId: 'TX001',
      addr1: '1-2-3 Test Street', addr2: 'Suite 100', addr3: '',
      city: 'Tokyo', state: 'Tokyo', zip: '100-0001', country: '日本'
    },
    shipping: null
  };
  var r1 = registerCustomerFromForm(p1);
  var s1 = r1.success && r1.customerId && /^CT-\d{5}$/.test(r1.customerId);
  if (s1) { pass++; testCustomerId = r1.customerId; testAddrIds.push(r1.addrId); testPayIds.push(r1.payId); }
  else    { fail++; }
  lines.push((s1 ? '✓' : '✗') + ' シナリオ1 新規登録');
  lines.push('  success=' + r1.success + ' customerId=' + r1.customerId + ' addrId=' + r1.addrId + ' payId=' + r1.payId);
  if (r1.warnings.length) lines.push('  warnings: ' + r1.warnings.join(' / '));
  if (r1.errors.length)   lines.push('  errors: '   + r1.errors.join(' / '));
  lines.push('');

  // ---- シナリオ2: 同一源流2回目（住所追加のみ）----
  var p2 = {
    token: token2,
    billing: {
      name: 'TEST Customer PR18', phone: '06-9876-5432',
      email: 'test.pr18.2nd@example.com', taxId: '',
      addr1: '4-5-6 Another St', addr2: '', addr3: '',
      city: 'Osaka', state: 'Osaka', zip: '530-0001', country: '日本'
    },
    shipping: null
  };
  var r2 = registerCustomerFromForm(p2);
  // 重複ガード: 顧客ID は既存と同じ、配送先/支払先は新規 (既定=FALSE)
  var s2 = r2.success && r2.customerId === testCustomerId && r2.addrId !== r1.addrId;
  if (s2) { pass++; testAddrIds.push(r2.addrId); testPayIds.push(r2.payId); }
  else    { fail++; }
  lines.push((s2 ? '✓' : '✗') + ' シナリオ2 同一源流2回目（住所追加のみ）');
  lines.push('  success=' + r2.success + ' customerId=' + r2.customerId + ' addrId=' + r2.addrId + ' payId=' + r2.payId);
  if (r2.errors.length) lines.push('  errors: ' + r2.errors.join(' / '));
  lines.push('');

  // ---- シナリオ3: トークン再使用拒否 ----
  var r3 = registerCustomerFromForm({ token: token1, billing: p1.billing, shipping: null });
  var s3 = !r3.success && r3.errors.some(function(e) { return e.indexOf('使用済み') >= 0; });
  if (s3) pass++; else fail++;
  lines.push((s3 ? '✓' : '✗') + ' シナリオ3 トークン再使用拒否');
  lines.push('  errors: ' + r3.errors.join(' / '));
  lines.push('');

  // ---- シナリオ4: バリデーションエラー ----
  var p4 = {
    token: token4,
    billing: {
      name: '',                          // 必須エラー
      phone: '',                         // 必須エラー
      email: '',                         // 必須エラー
      taxId: '',
      addr1: 'A'.repeat(40),             // 35字超エラー
      addr2: 'Full-width テスト通り',    // 文字種エラー
      addr3: '',
      city: 'Tokyo', state: '', zip: '', country: '日本'
      // 日本は郵便番号必須（expandCountryMaster後）→ zip空でエラー
    },
    shipping: null
  };
  var r4 = registerCustomerFromForm(p4);
  var s4 = !r4.success && r4.errors.length >= 3;
  if (s4) pass++; else fail++;
  lines.push((s4 ? '✓' : '✗') + ' シナリオ4 バリデーションエラー（期待3件以上、実際' + r4.errors.length + '件）');
  lines.push('  errors:');
  r4.errors.forEach(function(e) { lines.push('    - ' + e); });
  lines.push('');

  // ---- クリーンアップ ----
  try {
    _cleanupTestData(testCustomerId, testAddrIds, testPayIds, [token1, token2, token4]);
    lines.push('クリーンアップ完了 ✓');
  } catch (e) {
    lines.push('クリーンアップ失敗（手動確認が必要）: ' + e.message);
  }

  lines.push('');
  lines.push('結果: ' + pass + '/4 PASS' + (fail > 0 ? ' / ' + fail + ' FAIL ✗' : ' ✓'));
  return lines.join('\n');
}

/**
 * テストデータのクリーンアップ（下から削除して行ズレ防止）
 * @param {string}   custId    - CT-XXXXX
 * @param {string[]} addrIds   - AD-XXXXX 配列
 * @param {string[]} payIds    - PY-XXXXX 配列
 * @param {string[]} tokens    - トークン文字列配列
 */
function _cleanupTestData(custId, addrIds, payIds, tokens) {
  var ss = getSpreadsheet();

  function deleteRowsByIds(sh, colName, ids) {
    if (!sh || !ids || ids.length === 0) return;
    var data = sh.getDataRange().getValues();
    var h    = data[0];
    var idx  = h.indexOf(colName);
    if (idx < 0) return;
    var toDelete = [];
    for (var i = 1; i < data.length; i++) {
      if (ids.indexOf(String(data[i][idx] || '').trim()) >= 0) toDelete.push(i + 1);
    }
    for (var d = toDelete.length - 1; d >= 0; d--) {
      sh.deleteRow(toDelete[d]);
    }
  }

  // 顧客マスタ
  if (custId) deleteRowsByIds(ss.getSheetByName(CONFIG.SHEETS.CRM_CUSTOMERS), '顧客ID', [custId]);
  // 配送先
  if (addrIds && addrIds.length) deleteRowsByIds(ss.getSheetByName(CONFIG.SHEETS.CRM_SHIPPING), '配送先ID', addrIds);
  // 支払先
  if (payIds  && payIds.length)  deleteRowsByIds(ss.getSheetByName(CONFIG.SHEETS.CRM_PAYMENT),  '支払先ID', payIds);
  // フォームトークン
  if (tokens  && tokens.length) {
    var tokSh = ss.getSheetByName(FORM_TOKEN_SHEET);
    if (tokSh) {
      var tokData = tokSh.getDataRange().getValues();
      var tokH    = tokData[0];
      var tokIdx  = tokH.indexOf('トークン');
      if (tokIdx >= 0) {
        var toDelTok = [];
        for (var t = 1; t < tokData.length; t++) {
          if (tokens.indexOf(String(tokData[t][tokIdx] || '').trim()) >= 0) toDelTok.push(t + 1);
        }
        for (var dt = toDelTok.length - 1; dt >= 0; dt--) tokSh.deleteRow(toDelTok[dt]);
      }
    }
  }
}

// ============================================================
// 6. フォームURL発行・トークン検証
// ============================================================

/**
 * トークンが未使用で有効か検証
 * @param {string} token
 * @returns {{valid: boolean, error?: string}}
 */
function validateFormToken(token) {
  if (!token || String(token).trim() === '') {
    return { valid: false, error: 'トークンが指定されていません。' };
  }
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(FORM_TOKEN_SHEET);
  if (!sh) return { valid: false, error: 'フォームトークンシートが存在しません。' };
  var data = sh.getDataRange().getValues();
  var h = data[0];
  var tokIdx = h.indexOf('トークン');
  var useIdx = h.indexOf('使用日');
  if (tokIdx < 0) return { valid: false, error: 'トークン列が見つかりません。' };
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][tokIdx]).trim() === String(token).trim()) {
      var usedDate = String(data[i][useIdx] || '').trim();
      if (usedDate !== '') {
        return { valid: false, error: 'このURLは既に使用済みです（使用日: ' + usedDate + '）。' };
      }
      return { valid: true };
    }
  }
  return { valid: false, error: '無効なトークンです。URLが正しいか確認してください。' };
}

/**
 * 国マスタから登録フォーム用の国リストを取得
 * @returns {Array<{name, dialCode, stateRequired, postalRequired}>}
 */
function getCountriesForForm() {
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('国マスタ');
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var h = data[0];
  var nameIdx   = h.indexOf('国名（表示）');
  var codeIdx   = h.indexOf('国番号');
  var stateIdx  = h.indexOf('州必須');
  var postalIdx = h.indexOf('郵便番号必須');
  var validIdx  = h.indexOf('有効');
  if (nameIdx < 0) return [];
  return data.slice(1).filter(function(r) {
    var name  = String(r[nameIdx]  || '').trim();
    var valid = validIdx < 0 || String(r[validIdx] || '').toUpperCase() !== 'FALSE';
    return name && valid;
  }).map(function(r) {
    return {
      name:          String(r[nameIdx] || '').trim(),
      dialCode:      codeIdx  >= 0 ? String(r[codeIdx]  || '').trim() : '',
      stateRequired:  stateIdx  >= 0 && String(r[stateIdx]  || '').toUpperCase() === 'TRUE',
      postalRequired: postalIdx >= 0 && String(r[postalIdx] || '').toUpperCase() === 'TRUE'
    };
  });
}

/**
 * リードIDに紐付くフォームトークンを発行し、完全URLを返す
 * @param {string} leadId
 * @returns {{success: boolean, token?: string, url?: string, error?: string}}
 */
function issueFormTokenWithUrl(leadId) {
  if (!leadId) return { success: false, error: 'リードIDが必要です' };
  try {
    var token   = issueFormToken(String(leadId));
    var baseUrl = getWebAppUrl();
    var url     = baseUrl + '?page=order-form&token=' + encodeURIComponent(token);
    return { success: true, token: token, url: url };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// 7. 機械テスト: testOrderFormFlow
// ============================================================

function testOrderFormFlow() {
  var leadId = 'LDI-00001';
  var lines  = ['=== testOrderFormFlow ==='];
  var token  = null;

  // T1: issueFormTokenWithUrl
  var r1 = issueFormTokenWithUrl(leadId);
  if (r1.success) {
    token = r1.token;
    lines.push('✓ T1 issueFormTokenWithUrl: token=' + token.substring(0, 8) + '...');
    lines.push('  url 先頭60字: ' + r1.url.substring(0, 60) + '...');
  } else {
    lines.push('✗ T1: ' + r1.error);
    return lines.join('\n') + '\n結果: 0/5 FAIL ✗';
  }

  // T2: トークンタブ記帳確認
  var ss   = getSpreadsheet();
  var sh   = ss.getSheetByName(FORM_TOKEN_SHEET);
  var data = sh.getDataRange().getValues();
  var h    = data[0];
  var tokIdx  = h.indexOf('トークン');
  var leadIdx = h.indexOf('リードID');
  var useIdx  = h.indexOf('使用日');
  var tokenRow = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][tokIdx]).trim() === token) { tokenRow = i; break; }
  }
  if (tokenRow < 0) {
    lines.push('✗ T2: トークンがシートに見つかりません');
  } else {
    var leadOk = String(data[tokenRow][leadIdx]) === leadId;
    var useOk  = String(data[tokenRow][useIdx] || '') === '';
    lines.push((leadOk && useOk)
      ? '✓ T2 記帳確認: リードID=' + String(data[tokenRow][leadIdx]) + ' 使用日=空欄'
      : '✗ T2: leadOk=' + leadOk + ' useOk=' + useOk);
  }

  // T3: validateFormToken 未使用 → valid
  var v1 = validateFormToken(token);
  lines.push(v1.valid
    ? '✓ T3 未使用トークン: valid=true'
    : '✗ T3: ' + v1.error);

  // T4: 無効トークン → invalid
  var v2 = validateFormToken('00000000-0000-0000-0000-000000000000');
  lines.push(!v2.valid
    ? '✓ T4 無効トークン: valid=false error=' + v2.error
    : '✗ T4: 無効トークンがvalidになる');

  // T5: 空トークン → invalid
  var v3 = validateFormToken('');
  lines.push(!v3.valid
    ? '✓ T5 空トークン: valid=false'
    : '✗ T5: 空トークンがvalidになる');

  // Cleanup
  if (tokenRow >= 0) { sh.deleteRow(tokenRow + 1); }
  lines.push('クリーンアップ完了 ✓');

  var passed = lines.filter(function(l) { return l.charAt(0) === '\u2713'; }).length;
  var total  = lines.filter(function(l) { return l.charAt(0) === '\u2713' || l.charAt(0) === '\u2717'; }).length;
  lines.push('\n結果: ' + passed + '/' + total + (passed === total ? ' PASS \u2713' : ' FAIL \u2717'));
  return lines.join('\n');
}
