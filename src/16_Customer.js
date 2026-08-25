/**
 * 顧客マスタ管理ロジック
 * Phase 3: ERP統合 - 顧客管理機能
 */

// ============================================================
// 1. createCustomer(customerData) - 顧客を作成
// ============================================================

/**
 * 顧客を作成する関数
 * @param {Object} customerData - 顧客データ
 * @param {string} customerData.billingName - 請求先名
 * @param {string} customerData.billingPhone - 請求先電話番号
 * @param {string} customerData.billingEmail - 請求先メールアドレス
 * @param {string} customerData.businessId - ビジネスID
 * @param {string} customerData.billingAddress1 - 請求先住所1
 * @param {string} customerData.billingAddress2 - 請求先住所2
 * @param {string} customerData.billingCity - 請求先市区町村
 * @param {string} customerData.billingState - 請求先州/県
 * @param {string} customerData.billingZip - 請求先郵便番号
 * @param {string} customerData.billingCountry - 請求先国
 * @param {string} customerData.deliveryName - 配送先名（オプション）
 * @param {string} customerData.deliveryPhone - 配送先電話番号（オプション）
 * @param {string} customerData.deliveryAddress1 - 配送先住所1（オプション）
 * @param {string} customerData.deliveryAddress2 - 配送先住所2（オプション）
 * @param {string} customerData.deliveryCity - 配送先市区町村（オプション）
 * @param {string} customerData.deliveryState - 配送先州/県（オプション）
 * @param {string} customerData.deliveryZip - 配送先郵便番号（オプション）
 * @param {string} customerData.deliveryCountry - 配送先国（オプション）
 * @param {string} customerData.notes - 備考（オプション）
 * @param {string} customerData.source - 登録経路（オプション、デフォルト: '手動'）
 * @returns {Object} { success, customerId, message }
 */
function createCustomer(customerData) {
  try {
    Logger.log('顧客作成開始: ' + JSON.stringify(customerData));

    // 必須パラメータチェック
    if (!customerData.billingName || !customerData.billingEmail) {
      throw new Error('必須パラメータが不足しています（billingName, billingEmail）');
    }

    // スプレッドシート取得
    const ss = getSpreadsheet();
    const customerSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMER_MASTER);

    if (!customerSheet) {
      throw new Error('顧客マスタシートが見つかりません');
    }

    // 1. CustomerID生成（CT-00001形式）
    const customerId = generateCustomerId(customerSheet);
    Logger.log('生成されたCustomerID: ' + customerId);

    // 2. 配送先が未指定の場合はbilling情報をコピー
    const deliveryName = customerData.deliveryName || customerData.billingName;
    const deliveryPhone = customerData.deliveryPhone || customerData.billingPhone;
    const deliveryAddress1 = customerData.deliveryAddress1 || customerData.billingAddress1;
    const deliveryAddress2 = customerData.deliveryAddress2 || customerData.billingAddress2 || '';
    const deliveryCity = customerData.deliveryCity || customerData.billingCity;
    const deliveryState = customerData.deliveryState || customerData.billingState;
    const deliveryZip = customerData.deliveryZip || customerData.billingZip;
    const deliveryCountry = customerData.deliveryCountry || customerData.billingCountry;

    // 3. M_Customerシートに追記（28列）
    const now = new Date();
    const customerRow = [
      customerId,                                 // 1: 顧客ID
      now,                                        // 2: 登録日
      customerData.billingName,                   // 3: Billing Name
      customerData.billingPhone || '',            // 4: Billing Phone
      customerData.billingEmail,                  // 5: Billing Email
      customerData.businessId || '',              // 6: Business ID
      customerData.billingAddress1 || '',         // 7: Billing Address 1
      customerData.billingAddress2 || '',         // 8: Billing Address 2
      customerData.billingCity || '',             // 9: Billing City
      customerData.billingState || '',            // 10: Billing State
      customerData.billingZip || '',              // 11: Billing ZIP
      customerData.billingCountry || '',          // 12: Billing Country
      deliveryName,                               // 13: Delivery Name
      deliveryPhone || '',                        // 14: Delivery Phone
      deliveryAddress1 || '',                     // 15: Delivery Address 1
      deliveryAddress2,                           // 16: Delivery Address 2
      deliveryCity || '',                         // 17: Delivery City
      deliveryState || '',                        // 18: Delivery State
      deliveryZip || '',                          // 19: Delivery ZIP
      deliveryCountry || '',                      // 20: Delivery Country
      'Active',                                   // 21: ステータス（デフォルト: Active）
      '',                                         // 22: 初回取引日（空）
      0,                                          // 23: 累計取引金額（0）
      '',                                         // 24: 最終取引日（空）
      0,                                          // 25: 取引回数（0）
      customerData.notes || '',                   // 26: 備考
      now,                                        // 27: 更新日
      customerData.source || '手動'               // 28: 登録経路
    ];

    customerSheet.appendRow(customerRow);
    Logger.log('顧客マスタシートに追記完了');

    Logger.log('顧客作成完了: ' + customerId);

    // 5. 作成したCustomerIDを返却
    return {
      success: true,
      customerId: customerId,
      message: '顧客を作成しました',
      data: {
        customerId: customerId,
        billingName: customerData.billingName,
        billingEmail: customerData.billingEmail
      }
    };

  } catch (error) {
    Logger.log('顧客作成エラー: ' + error.message);
    return {
      success: false,
      message: '顧客の作成に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 2. getCustomer(customerId) - 顧客を取得
// ============================================================

/**
 * 顧客を取得する関数
 * @param {string} customerId - 顧客ID（CT-00001）
 * @returns {Object} { success, customer, message }
 */
function getCustomer(customerId) {
  try {
    Logger.log('顧客取得開始: ' + customerId);

    if (!customerId) {
      throw new Error('顧客IDが指定されていません');
    }

    const ss = getSpreadsheet();
    const customerSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMER_MASTER);

    if (!customerSheet) {
      throw new Error('顧客マスタシートが見つかりません');
    }

    // 顧客マスタシートから検索
    const data = customerSheet.getDataRange().getValues();
    const headers = data[0];
    const customerIdIndex = headers.indexOf('顧客ID');

    if (customerIdIndex === -1) {
      throw new Error('顧客IDカラムが見つかりません');
    }

    let customerRow = null;
    let customerRowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][customerIdIndex] === customerId) {
        customerRow = data[i];
        customerRowIndex = i;
        break;
      }
    }

    if (!customerRow) {
      throw new Error('顧客が見つかりません: ' + customerId);
    }

    // 顧客データを構築
    const customer = {};
    headers.forEach((header, index) => {
      customer[header] = customerRow[index];
    });

    Logger.log('顧客取得完了: ' + customerId);

    return {
      success: true,
      customer: customer,
      rowIndex: customerRowIndex
    };

  } catch (error) {
    Logger.log('顧客取得エラー: ' + error.message);
    return {
      success: false,
      message: '顧客の取得に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 3. getCustomerByEmail(email) - メールアドレスで顧客を検索
// ============================================================

/**
 * メールアドレスで顧客を検索する関数
 * @param {string} email - メールアドレス
 * @returns {Object} { success, customers, message }
 */
function getCustomerByEmail(email) {
  try {
    Logger.log('メールアドレスで顧客検索開始: ' + email);

    if (!email) {
      throw new Error('メールアドレスが指定されていません');
    }

    const ss = getSpreadsheet();
    const customerSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMER_MASTER);

    if (!customerSheet) {
      throw new Error('顧客マスタシートが見つかりません');
    }

    // 顧客マスタシートから検索
    const data = customerSheet.getDataRange().getValues();
    const headers = data[0];
    const emailIndex = headers.indexOf('Billing Email');

    if (emailIndex === -1) {
      throw new Error('Billing Emailカラムが見つかりません');
    }

    const customers = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIndex] === email) {
        const customer = {};
        headers.forEach((header, index) => {
          customer[header] = data[i][index];
        });
        customers.push(customer);
      }
    }

    Logger.log('メールアドレスで顧客検索完了: ' + email + '（件数: ' + customers.length + '）');

    return {
      success: true,
      customers: customers,
      count: customers.length
    };

  } catch (error) {
    Logger.log('メールアドレスで顧客検索エラー: ' + error.message);
    return {
      success: false,
      message: '顧客検索に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 4. getCustomerByName(name) - 顧客名で検索（あいまい検索）
// ============================================================

/**
 * 顧客名で検索する関数（あいまい検索）
 * @param {string} name - 顧客名（部分一致）
 * @returns {Object} { success, customers, message }
 */
function getCustomerByName(name) {
  try {
    Logger.log('顧客名で検索開始: ' + name);

    if (!name) {
      throw new Error('顧客名が指定されていません');
    }

    const ss = getSpreadsheet();
    const customerSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMER_MASTER);

    if (!customerSheet) {
      throw new Error('顧客マスタシートが見つかりません');
    }

    // 顧客マスタシートから検索
    const data = customerSheet.getDataRange().getValues();
    const headers = data[0];
    const nameIndex = headers.indexOf('Billing Name');

    if (nameIndex === -1) {
      throw new Error('Billing Nameカラムが見つかりません');
    }

    const customers = [];
    const searchName = name.toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const billingName = String(data[i][nameIndex]).toLowerCase();
      if (billingName.includes(searchName)) {
        const customer = {};
        headers.forEach((header, index) => {
          customer[header] = data[i][index];
        });
        customers.push(customer);
      }
    }

    Logger.log('顧客名で検索完了: ' + name + '（件数: ' + customers.length + '）');

    return {
      success: true,
      customers: customers,
      count: customers.length
    };

  } catch (error) {
    Logger.log('顧客名で検索エラー: ' + error.message);
    return {
      success: false,
      message: '顧客検索に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 5. getAllCustomers(status) - 全顧客を取得
// ============================================================

/**
 * 全顧客を取得する関数
 * @param {string} status - ステータスフィルタ（デフォルト: 'Active'）
 * @returns {Object} { success, customers, message }
 */
function getAllCustomers(status) {
  try {
    const filterStatus = status || 'Active';
    Logger.log('全顧客取得開始（ステータス: ' + filterStatus + '）');

    const ss = getSpreadsheet();
    const customerSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMER_MASTER);

    if (!customerSheet) {
      throw new Error('顧客マスタシートが見つかりません');
    }

    // 顧客マスタシートから全データ取得
    const data = customerSheet.getDataRange().getValues();
    const headers = data[0];
    const statusIndex = headers.indexOf('ステータス');

    if (statusIndex === -1) {
      throw new Error('ステータスカラムが見つかりません');
    }

    const customers = [];

    for (let i = 1; i < data.length; i++) {
      // ステータスでフィルタリング
      if (filterStatus === '' || data[i][statusIndex] === filterStatus) {
        const customer = {};
        headers.forEach((header, index) => {
          customer[header] = data[i][index];
        });
        customers.push(customer);
      }
    }

    Logger.log('全顧客取得完了（件数: ' + customers.length + '）');

    return {
      success: true,
      customers: customers,
      count: customers.length
    };

  } catch (error) {
    Logger.log('全顧客取得エラー: ' + error.message);
    return {
      success: false,
      message: '顧客一覧の取得に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 6. updateCustomer(customerId, updates) - 顧客情報を更新
// ============================================================

/**
 * 顧客情報を更新する関数
 * @param {string} customerId - 顧客ID（CT-00001）
 * @param {Object} updates - 更新データ
 * @returns {Object} { success, message }
 */
function updateCustomer(customerId, updates) {
  try {
    Logger.log('顧客更新開始: ' + customerId);
    Logger.log('更新内容: ' + JSON.stringify(updates));

    if (!customerId) {
      throw new Error('顧客IDが指定されていません');
    }

    const ss = getSpreadsheet();
    const customerSheet = ss.getSheetByName(CONFIG.SHEETS.CUSTOMER_MASTER);

    if (!customerSheet) {
      throw new Error('顧客マスタシートが見つかりません');
    }

    // 顧客を検索
    const data = customerSheet.getDataRange().getValues();
    const headers = data[0];
    const customerIdIndex = headers.indexOf('顧客ID');
    const updateDateIndex = headers.indexOf('更新日');

    if (customerIdIndex === -1) {
      throw new Error('顧客IDカラムが見つかりません');
    }

    let targetRowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][customerIdIndex] === customerId) {
        targetRowIndex = i + 1; // シートの行番号（1-indexed）
        break;
      }
    }

    if (targetRowIndex === -1) {
      throw new Error('顧客が見つかりません: ' + customerId);
    }

    // 更新処理
    Object.keys(updates).forEach(key => {
      const colIndex = headers.indexOf(key);
      if (colIndex !== -1) {
        customerSheet.getRange(targetRowIndex, colIndex + 1).setValue(updates[key]);
        Logger.log('更新: ' + key + ' = ' + updates[key]);
      } else {
        Logger.log('警告: 列が見つかりません: ' + key);
      }
    });

    // 更新日を自動設定
    if (updateDateIndex !== -1) {
      customerSheet.getRange(targetRowIndex, updateDateIndex + 1).setValue(new Date());
    }

    Logger.log('顧客更新完了: ' + customerId);

    return {
      success: true,
      message: '顧客情報を更新しました'
    };

  } catch (error) {
    Logger.log('顧客更新エラー: ' + error.message);
    return {
      success: false,
      message: '顧客情報の更新に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// 7. updateCustomerTransactionStats(customerId, transactionAmount, transactionDate) - 取引統計を更新
// ============================================================

/**
 * 取引統計を更新する関数（請求書作成時に呼び出される）
 * @param {string} customerId - 顧客ID（CT-00001）
 * @param {number} transactionAmount - 取引金額
 * @param {Date} transactionDate - 取引日
 * @returns {Object} { success, message }
 */
function updateCustomerTransactionStats(customerId, transactionAmount, transactionDate) {
  try {
    Logger.log('取引統計更新開始: ' + customerId + ', 金額: ' + transactionAmount);

    if (!customerId) {
      throw new Error('顧客IDが指定されていません');
    }

    // 顧客情報を取得
    const result = getCustomer(customerId);
    if (!result.success) {
      throw new Error('顧客が見つかりません: ' + customerId);
    }

    const customer = result.customer;

    // 統計を更新
    const updates = {};

    // 1. 累計取引金額を更新
    const currentTotal = Number(customer['累計取引金額']) || 0;
    updates['累計取引金額'] = currentTotal + transactionAmount;

    // 2. 取引回数をインクリメント
    const currentCount = Number(customer['取引回数']) || 0;
    updates['取引回数'] = currentCount + 1;

    // 3. 最終取引日を更新
    updates['最終取引日'] = transactionDate || new Date();

    // 4. 初回取引日がない場合は設定
    if (!customer['初回取引日']) {
      updates['初回取引日'] = transactionDate || new Date();
    }

    // 顧客情報を更新
    const updateResult = updateCustomer(customerId, updates);

    if (!updateResult.success) {
      throw new Error('顧客情報の更新に失敗しました');
    }

    Logger.log('取引統計更新完了: ' + customerId);

    return {
      success: true,
      message: '取引統計を更新しました',
      data: {
        累計取引金額: updates['累計取引金額'],
        取引回数: updates['取引回数'],
        最終取引日: updates['最終取引日']
      }
    };

  } catch (error) {
    Logger.log('取引統計更新エラー: ' + error.message);
    return {
      success: false,
      message: '取引統計の更新に失敗しました: ' + error.message
    };
  }
}

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * 顧客IDを生成（CT-00001形式、ゼロパディング5桁）
 * @param {Sheet} sheet - 顧客マスタシート
 * @returns {string} 顧客ID
 */
function generateCustomerId(sheet) {
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;

  // 既存のIDから最大番号を取得
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0]); // 顧客IDは1列目
    if (id.startsWith('CT-')) {
      const num = parseInt(id.substring(3));
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  // 次の番号を生成
  const nextNum = maxNum + 1;
  return 'CT-' + String(nextNum).padStart(5, '0');
}

// ============================================================
// テスト用関数（開発用）
// ============================================================

/**
 * 顧客作成テスト
 */
function testCreateCustomer() {
  const testData = {
    billingName: 'ABC Trading LLC',
    billingPhone: '+1-234-567-8900',
    billingEmail: 'contact@example.invalid',
    businessId: '12-3456789',
    billingAddress1: '123 Main Street',
    billingAddress2: 'Suite 100',
    billingCity: 'New York',
    billingState: 'NY',
    billingZip: '10001',
    billingCountry: 'United States',
    deliveryName: 'ABC Trading Warehouse',
    deliveryPhone: '+1-234-567-8901',
    deliveryAddress1: '456 Warehouse Rd',
    deliveryAddress2: 'Building A',
    deliveryCity: 'Los Angeles',
    deliveryState: 'CA',
    deliveryZip: '90001',
    deliveryCountry: 'United States',
    notes: 'テスト顧客',
    source: 'フォーム'
  };

  const result = createCustomer(testData);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

/**
 * 顧客取得テスト
 */
function testGetCustomer() {
  const customerId = 'CT-00001';
  const result = getCustomer(customerId);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

/**
 * メールアドレスで顧客検索テスト
 */
function testGetCustomerByEmail() {
  const email = 'contact@example.invalid';
  const result = getCustomerByEmail(email);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

/**
 * 顧客更新テスト
 */
function testUpdateCustomer() {
  const customerId = 'CT-00001';
  const updates = {
    'Billing Phone': '+1-234-567-9999',
    '備考': 'テスト更新'
  };
  const result = updateCustomer(customerId, updates);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

/**
 * 取引統計更新テスト
 */
function testUpdateCustomerTransactionStats() {
  const customerId = 'CT-00001';
  const transactionAmount = 100000;
  const transactionDate = new Date();
  const result = updateCustomerTransactionStats(customerId, transactionAmount, transactionDate);
  Logger.log('テスト結果: ' + JSON.stringify(result));
  return result;
}

// ============================================================
// フォーム検査（PR15）
// ============================================================

/**
 * 顧客登録フォームの構成を検査（読み取りのみ）
 * スクリプトプロパティ CUSTOMER_FORM_ID が必要
 */
function inspectForm() {
  const formId = PropertiesService.getScriptProperties().getProperty('CUSTOMER_FORM_ID');
  if (!formId) throw new Error('CUSTOMER_FORM_ID 未設定');
  const form = FormApp.openById(formId);
  const items = form.getItems().map((it, i) => {
    let req = '';
    try { req = it.asTextItem && it.getType() === FormApp.ItemType.TEXT
          ? (it.asTextItem().isRequired() ? '必須' : '任意') : ''; } catch(e) {}
    if (it.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      req = it.asMultipleChoiceItem().isRequired() ? '必須' : '任意'; }
    return (i+1) + '. [' + it.getType() + '][' + (req||'—') + '] ' + it.getTitle();
  });
  const out = [
    'タイトル: ' + form.getTitle(),
    '回答先シートID: ' + (form.getDestinationId() || '（未設定）'),
    '質問数: ' + items.length
  ].concat(items).join('\n');
  Logger.log(out);
  return out;
}
