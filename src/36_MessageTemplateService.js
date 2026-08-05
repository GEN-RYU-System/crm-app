/**
 * メッセージテンプレートサービス
 *
 * スプレッドシートの「メッセージテンプレート」シートを管理する。
 *
 * シート列構成:
 * A: テンプレートID (MT-00001...)
 * B: ページ (リード / 新規 / ルート / アーカイブ / 共通)
 * C: カテゴリ (挨拶 / フォローアップ / クロージング 等)
 * D: タイトル
 * E: 本文 ({{顧客名}} 等のプレースホルダーを含む)
 * F: 有効 (TRUE / FALSE)
 * G: 英語本文 (English body with {{顧客名}} placeholders)
 */

/**
 * 「メッセージテンプレート」シートを新規作成してサンプルデータを投入する。
 * 既に存在する場合は何もしない。
 * clasp run createMessageTemplateSheet で実行。
 */
function createMessageTemplateSheet() {
  const ss = getSpreadsheet();
  const SHEET_NAME = 'メッセージテンプレート';

  // 既存シートの確認
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    Logger.log('シート「' + SHEET_NAME + '」は既に存在します。処理をスキップします。');
    return { success: true, message: '既に存在します', sheetName: SHEET_NAME };
  }

  // 新規シート作成
  sheet = ss.insertSheet(SHEET_NAME);
  Logger.log('シート「' + SHEET_NAME + '」を作成しました。');

  // ヘッダー行
  const headers = ['テンプレートID', 'ページ', 'カテゴリ', 'タイトル', '本文', '有効', '英語本文'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダー行の書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4a5568');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  // 列幅の調整
  sheet.setColumnWidth(1, 120); // テンプレートID
  sheet.setColumnWidth(2, 80);  // ページ
  sheet.setColumnWidth(3, 120); // カテゴリ
  sheet.setColumnWidth(4, 200); // タイトル
  sheet.setColumnWidth(5, 400); // 本文
  sheet.setColumnWidth(6, 60);  // 有効
  sheet.setColumnWidth(7, 400); // 英語本文

  // サンプルデータ (ID, ページ, カテゴリ, タイトル, 本文, 有効, 英語本文)
  const samples = [
    // 共通
    ['MT-00001', '共通', '挨拶', '初回ご連絡',
      'はじめまして、{{顧客名}}様。\nこの度はお問い合わせいただきありがとうございます。\nどのようなご要望でしょうか？',
      true,
      'Hi {{顧客名}},\nThank you for reaching out to us!\nHow can we help you today?'],
    ['MT-00002', '共通', '挨拶', 'フォローアップ',
      'お世話になっております、{{顧客名}}様。\n先日のご連絡についてその後いかがでしょうか？',
      true,
      'Hi {{顧客名}},\nI hope you are doing well!\nI wanted to follow up on our previous conversation. How are things going?'],
    ['MT-00003', '共通', 'その他', '確認応答',
      'ご確認いただきありがとうございます。\nご不明な点がございましたらお気軽にお申し付けください。',
      true,
      'Thank you for confirming!\nPlease feel free to reach out if you have any questions.'],

    // リード
    ['MT-00004', 'リード', '挨拶', '初回アプローチ',
      'はじめまして！{{顧客名}}様。\n{{国}}でトレーディングカードの卸売に興味をお持ちとのこと、ぜひ一度詳しくお話しできればと思います。',
      true,
      'Hello {{顧客名}}!\nI heard you are interested in trading card wholesale in {{国}}. We would love to discuss this further with you!'],
    ['MT-00005', 'リード', 'フォローアップ', '商品カタログ案内',
      '{{顧客名}}様、こんにちは。\n弊社の最新在庫リストをお送りします。ご興味のある商品がございましたらお知らせください。',
      true,
      'Hi {{顧客名}},\nI am sending you our latest stock list. Please let us know if there are any items you are interested in!'],
    ['MT-00006', 'リード', 'クロージング', 'サンプル注文提案',
      '{{顧客名}}様、\nまずは少量のサンプル注文からいかがでしょうか？実際の品質をご確認いただけます。',
      true,
      'Hi {{顧客名}},\nHow about starting with a small sample order? This way you can check the quality for yourself before committing to a larger order.'],

    // 新規
    ['MT-00007', '新規', '挨拶', '新規顧客ウェルカム',
      'ようこそ、{{顧客名}}様！\n初回ご注文ありがとうございます。ご不明な点があればいつでもご連絡ください。',
      true,
      'Welcome, {{顧客名}}!\nThank you so much for your first order! Please do not hesitate to contact us if you have any questions.'],
    ['MT-00008', '新規', 'フォローアップ', '発送通知',
      '{{顧客名}}様、\nご注文品の発送手配が完了しました。追跡番号をお送りしますのでご確認ください。',
      true,
      'Hi {{顧客名}},\nYour order has been shipped! I will send you the tracking number shortly. Please check it out.'],
    ['MT-00009', '新規', 'クロージング', 'リピート提案',
      '{{顧客名}}様、\n前回のご注文はいかがでしたでしょうか？新しい入荷情報もございますのでぜひご検討ください。',
      true,
      'Hi {{顧客名}},\nHow was your previous order? We have some exciting new arrivals that you might be interested in!'],

    // ルート
    ['MT-00010', 'ルート', 'フォローアップ', '定期フォロー',
      'お世話になっております、{{顧客名}}様。\n最近の販売状況はいかがでしょうか？新商品の情報もありますのでご連絡いたしました。',
      true,
      'Hi {{顧客名}},\nI hope business is going well! I also wanted to share some new product information with you.'],
    ['MT-00011', 'ルート', 'クロージング', 'まとめ買い提案',
      '{{顧客名}}様、\nまとめてご注文いただくと特別価格でご提供できます。ご検討いただけますでしょうか？',
      true,
      'Hi {{顧客名}},\nIf you place a bulk order, we can offer you a special price. Would you like to consider it?'],
  ];

  sheet.getRange(2, 1, samples.length, headers.length).setValues(samples);

  // 本文・英語本文列のテキスト折り返し設定
  sheet.getRange(2, 5, samples.length, 1).setWrap(true);
  sheet.getRange(2, 7, samples.length, 1).setWrap(true);

  // 行の高さを調整
  for (let i = 2; i <= samples.length + 1; i++) {
    sheet.setRowHeight(i, 80);
  }

  // シートをフリーズ（ヘッダー固定）
  sheet.setFrozenRows(1);

  Logger.log('「' + SHEET_NAME + '」シートのセットアップが完了しました。' + samples.length + '件のサンプルデータを追加しました。');

  return {
    success: true,
    message: 'シート作成完了',
    sheetName: SHEET_NAME,
    rowCount: samples.length
  };
}

/**
 * 既存の「メッセージテンプレート」シートに「シーン」列を追加する。
 * ページとカテゴリの間（C列）に挿入し、既存列を右にシフト。
 * clasp run addSceneColumn で実行。
 */
function addSceneColumn() {
  const ss = getSpreadsheet();
  const SHEET_NAME = 'メッセージテンプレート';
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { success: false, message: 'シートが見つかりません' };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (headers.indexOf('シーン') !== -1) {
    Logger.log('「シーン」列は既に存在します');
    return { success: true, message: '既に存在します' };
  }

  // C列（3列目）に挿入（ページの右隣）
  const INSERT_COL = 3;
  sheet.insertColumnBefore(INSERT_COL);

  // ヘッダーを設定
  sheet.getRange(1, INSERT_COL).setValue('シーン');
  sheet.getRange(1, INSERT_COL).setBackground('#4a5568').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setColumnWidth(INSERT_COL, 150);

  // サンプルのシーン値（既存データの行順に対応）
  // MT-00001〜11 の順番で設定
  const sceneValues = [
    [''],              // MT-00001 共通/挨拶 → シーン不要
    [''],              // MT-00002 共通/挨拶 → シーン不要
    [''],              // MT-00003 共通/その他 → シーン不要
    ['初回接触'],      // MT-00004 リード/挨拶
    ['フォローアップ'], // MT-00005 リード/FU
    ['クロージング'],  // MT-00006 リード/クロージング
    ['初回接触'],      // MT-00007 新規/挨拶
    ['フォローアップ'], // MT-00008 新規/FU
    ['クロージング'],  // MT-00009 新規/クロージング
    ['フォローアップ'], // MT-00010 ルート/FU
    ['クロージング'],  // MT-00011 ルート/クロージング
  ];

  const lastRow = sheet.getLastRow();
  const dataRows = Math.min(sceneValues.length, lastRow - 1);
  sheet.getRange(2, INSERT_COL, dataRows, 1).setValues(sceneValues.slice(0, dataRows));

  Logger.log('「シーン」列を C列に追加しました');
  return { success: true, message: 'シーン列を追加しました', insertedAt: 'C列' };
}

/**
 * 既存の「メッセージテンプレート」シートに「英語本文（長文）」「英語本文（簡潔）」「英語本文（カジュアル）」列を追加する。
 * 列がすでに存在する場合はスキップ。
 * clasp run addEnglishStyleColumns で実行。
 */
function addEnglishStyleColumns() {
  const ss = getSpreadsheet();
  const SHEET_NAME = 'メッセージテンプレート';
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { success: false, message: 'シートが見つかりません' };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const added = [];

  ['英語本文（長文）', '英語本文（簡潔）', '英語本文（カジュアル）'].forEach(colName => {
    if (headers.indexOf(colName) !== -1) {
      Logger.log('「' + colName + '」列は既に存在します');
      return;
    }
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue(colName);
    sheet.getRange(1, newCol).setBackground('#4a5568').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setColumnWidth(newCol, 400);
    sheet.getRange(2, newCol, Math.max(sheet.getLastRow() - 1, 1), 1).setWrap(true);
    added.push(colName);
    Logger.log('「' + colName + '」列を追加しました');
  });

  return { success: true, message: added.length > 0 ? added.join(', ') + ' を追加しました' : '全列すでに存在します' };
}

/**
 * 既存の「メッセージテンプレート」シートに G列「英語本文」を追加してサンプルデータを更新する。
 * clasp run addEnglishBodyColumn で実行。
 */
function addEnglishBodyColumn() {
  const ss = getSpreadsheet();
  const SHEET_NAME = 'メッセージテンプレート';
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    Logger.log('シート「' + SHEET_NAME + '」が見つかりません');
    return { success: false, message: 'シートが見つかりません' };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // G列（英語本文）が既に存在するか確認
  if (headers.indexOf('英語本文') !== -1) {
    Logger.log('「英語本文」列は既に存在します');
    return { success: true, message: '既に存在します' };
  }

  // G列ヘッダーを追加
  const lastCol = headers.length + 1;
  sheet.getRange(1, lastCol).setValue('英語本文');
  sheet.getRange(1, lastCol).setBackground('#4a5568').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setColumnWidth(lastCol, 400);

  // サンプルの英語本文データ（行順はシートのID順に対応）
  const englishBodies = [
    'Hi {{顧客名}},\nThank you for reaching out to us!\nHow can we help you today?',
    'Hi {{顧客名}},\nI hope you are doing well!\nI wanted to follow up on our previous conversation. How are things going?',
    'Thank you for confirming!\nPlease feel free to reach out if you have any questions.',
    'Hello {{顧客名}}!\nI heard you are interested in trading card wholesale in {{国}}. We would love to discuss this further with you!',
    'Hi {{顧客名}},\nI am sending you our latest stock list. Please let us know if there are any items you are interested in!',
    'Hi {{顧客名}},\nHow about starting with a small sample order? This way you can check the quality for yourself before committing to a larger order.',
    'Welcome, {{顧客名}}!\nThank you so much for your first order! Please do not hesitate to contact us if you have any questions.',
    'Hi {{顧客名}},\nYour order has been shipped! I will send you the tracking number shortly. Please check it out.',
    'Hi {{顧客名}},\nHow was your previous order? We have some exciting new arrivals that you might be interested in!',
    'Hi {{顧客名}},\nI hope business is going well! I also wanted to share some new product information with you.',
    'Hi {{顧客名}},\nIf you place a bulk order, we can offer you a special price. Would you like to consider it?',
  ];

  const rowCount = Math.min(englishBodies.length, data.length - 1);
  for (let i = 0; i < rowCount; i++) {
    sheet.getRange(i + 2, lastCol).setValue(englishBodies[i]);
  }

  // 英語本文列の折り返し設定
  sheet.getRange(2, lastCol, rowCount, 1).setWrap(true);

  Logger.log('「英語本文」列を追加し、' + rowCount + '件のサンプルデータを投入しました');

  return {
    success: true,
    message: '英語本文列を追加しました',
    rowCount: rowCount
  };
}

/**
 * メッセージテンプレート一覧を取得する（内部実装）。
 * 有効フラグが TRUE のもののみ返す。
 * フロントエンドからは 27_WebApp.gs の getMessageTemplates() 経由で呼び出す。
 * @returns {Array} テンプレート配列
 */
function getMessageTemplates_service() {
  try {
    const ss = getSpreadsheet();
    const SHEET_NAME = 'メッセージテンプレート';
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      Logger.log('[getMessageTemplates] シート「' + SHEET_NAME + '」が見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return [];
    }

    const headers = data[0];
    const idIdx           = headers.indexOf('テンプレートID');
    const pageIdx         = headers.indexOf('ページ');
    const sceneIdx        = headers.indexOf('シーン');
    const categoryIdx     = headers.indexOf('カテゴリ');
    const titleIdx        = headers.indexOf('タイトル');
    const summaryIdx      = headers.indexOf('概要');
    const bodyIdx         = headers.indexOf('本文');
    const enabledIdx      = headers.indexOf('有効');
    const bodyEnLongIdx   = headers.indexOf('英語本文（長文）');
    const bodyEnShortIdx  = headers.indexOf('英語本文（簡潔）');
    const bodyEnCasualIdx = headers.indexOf('英語本文（カジュアル）');
    const bodyEnIdx       = headers.indexOf('英語本文'); // 後方互換

    const templates = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // 空行スキップ
      if (!row[idIdx]) continue;

      // 有効フラグチェック
      const enabled = row[enabledIdx];
      if (enabled !== true && enabled !== 'TRUE' && enabled !== '1') continue;

      const bodyEnLong = bodyEnLongIdx !== -1 ? (row[bodyEnLongIdx] || '') : '';
      templates.push({
        id:           row[idIdx],
        page:         row[pageIdx],
        scene:        sceneIdx        !== -1 ? (row[sceneIdx]        || '') : '',
        category:     row[categoryIdx],
        title:        row[titleIdx],
        summary:      summaryIdx      !== -1 ? (row[summaryIdx]      || '') : '',
        body:         bodyIdx         !== -1 ? (row[bodyIdx]         || '') : '',
        bodyEnLong:   bodyEnLong,
        bodyEnShort:  bodyEnShortIdx  !== -1 ? (row[bodyEnShortIdx]  || '') : '',
        bodyEnCasual: bodyEnCasualIdx !== -1 ? (row[bodyEnCasualIdx] || '') : '',
        bodyEn:       bodyEnLong || (bodyEnIdx !== -1 ? (row[bodyEnIdx] || '') : '') // チャットページ後方互換
      });
    }

    Logger.log('[getMessageTemplates] ' + templates.length + '件のテンプレートを取得しました');
    return templates;

  } catch (error) {
    Logger.log('[getMessageTemplates] エラー: ' + error.message);
    Logger.log(error.stack);
    return [];
  }
}

/**
 * メッセージテンプレート全件取得（有効フラグ問わず・管理ページ用）
 * @returns {Array} 全テンプレート配列
 */
function getAllMessageTemplates_service() {
  try {
    const ss = getSpreadsheet();
    const SHEET_NAME = 'メッセージテンプレート';
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      Logger.log('[getAllMessageTemplates] シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0];
    const idIdx           = headers.indexOf('テンプレートID');
    const pageIdx         = headers.indexOf('ページ');
    const sceneIdx        = headers.indexOf('シーン');
    const categoryIdx     = headers.indexOf('カテゴリ');
    const titleIdx        = headers.indexOf('タイトル');
    const summaryIdx      = headers.indexOf('概要');
    const bodyIdx         = headers.indexOf('本文');
    const enabledIdx      = headers.indexOf('有効');
    const bodyEnLongIdx   = headers.indexOf('英語本文（長文）');
    const bodyEnShortIdx  = headers.indexOf('英語本文（簡潔）');
    const bodyEnCasualIdx = headers.indexOf('英語本文（カジュアル）');
    const bodyEnIdx       = headers.indexOf('英語本文'); // 後方互換

    const templates = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[idIdx]) continue;

      const enabled = row[enabledIdx];
      const bodyEnLong = bodyEnLongIdx !== -1 ? (row[bodyEnLongIdx] || '') : '';
      templates.push({
        id:           row[idIdx],
        page:         pageIdx         !== -1 ? (row[pageIdx]         || '') : '',
        scene:        sceneIdx        !== -1 ? (row[sceneIdx]        || '') : '',
        category:     categoryIdx     !== -1 ? (row[categoryIdx]     || '') : '',
        title:        titleIdx        !== -1 ? (row[titleIdx]        || '') : '',
        summary:      summaryIdx      !== -1 ? (row[summaryIdx]      || '') : '',
        body:         bodyIdx         !== -1 ? (row[bodyIdx]         || '') : '',
        bodyEnLong:   bodyEnLong,
        bodyEnShort:  bodyEnShortIdx  !== -1 ? (row[bodyEnShortIdx]  || '') : '',
        bodyEnCasual: bodyEnCasualIdx !== -1 ? (row[bodyEnCasualIdx] || '') : '',
        enabled:      enabled === true || enabled === 'TRUE' || enabled === '1',
        bodyEn:       bodyEnLong || (bodyEnIdx !== -1 ? (row[bodyEnIdx] || '') : '') // チャットページ後方互換
      });
    }

    Logger.log('[getAllMessageTemplates] ' + templates.length + '件取得');
    return templates;

  } catch (error) {
    Logger.log('[getAllMessageTemplates] エラー: ' + error.message);
    return [];
  }
}

/**
 * 次のテンプレートIDを採番（内部用）
 * @returns {string} MT-XXXXX 形式のID
 */
function getNextTemplateId_() {
  const sheet = getSpreadsheet().getSheetByName('メッセージテンプレート');
  if (!sheet) return 'MT-00001';

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('テンプレートID');
  if (idIdx === -1) return 'MT-00001';

  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][idIdx] || '');
    const m = id.match(/MT-(\d+)/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'MT-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * メッセージテンプレートを新規作成する
 * @param {Object} templateData - テンプレートデータ
 * @returns {Object} { success, templateId, message }
 */
function createTemplate_service(templateData) {
  try {
    const ss = getSpreadsheet();
    const SHEET_NAME = 'メッセージテンプレート';
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return { success: false, error: 'シートが見つかりません' };
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newId = getNextTemplateId_();

    const newRow = new Array(headers.length).fill('');
    const set = (key, val) => {
      const idx = headers.indexOf(key);
      if (idx !== -1) newRow[idx] = val;
    };

    set('テンプレートID',       newId);
    set('ページ',               templateData.page         || '');
    set('シーン',               templateData.scene        || '');
    set('カテゴリ',             templateData.category     || '');
    set('タイトル',             templateData.title        || '');
    set('概要',                 templateData.summary      || '');
    set('本文',                 templateData.body         || '');
    set('有効',                 templateData.enabled !== false);
    set('英語本文（長文）',     templateData.bodyEnLong   || '');
    set('英語本文（簡潔）',     templateData.bodyEnShort  || '');
    set('英語本文（カジュアル）', templateData.bodyEnCasual || '');

    sheet.appendRow(newRow);

    Logger.log('[createTemplate] ' + newId + ' を作成しました');
    return { success: true, templateId: newId, message: newId + ' を作成しました' };

  } catch (error) {
    Logger.log('[createTemplate] エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * メッセージテンプレートを更新する
 * @param {string} templateId - テンプレートID
 * @param {Object} templateData - 更新データ
 * @returns {Object} { success, message }
 */
function updateTemplate_service(templateId, templateData) {
  try {
    const ss = getSpreadsheet();
    const SHEET_NAME = 'メッセージテンプレート';
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return { success: false, error: 'シートが見つかりません' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('テンプレートID');

    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(templateId)) {
        targetRow = i + 1; // 1-based
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, error: 'テンプレートID ' + templateId + ' が見つかりません' };
    }

    const set = (key, val) => {
      const idx = headers.indexOf(key);
      if (idx !== -1) sheet.getRange(targetRow, idx + 1).setValue(val);
    };

    set('ページ',                 templateData.page         || '');
    set('シーン',                 templateData.scene        || '');
    set('カテゴリ',               templateData.category     || '');
    set('タイトル',               templateData.title        || '');
    set('概要',                   templateData.summary      || '');
    set('本文',                   templateData.body         || '');
    set('有効',                   templateData.enabled !== false);
    set('英語本文（長文）',       templateData.bodyEnLong   || '');
    set('英語本文（簡潔）',       templateData.bodyEnShort  || '');
    set('英語本文（カジュアル）', templateData.bodyEnCasual || '');

    Logger.log('[updateTemplate] ' + templateId + ' を更新しました');
    return { success: true, message: templateId + ' を更新しました' };

  } catch (error) {
    Logger.log('[updateTemplate] エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * メッセージテンプレートを削除する
 * @param {string} templateId - テンプレートID
 * @returns {Object} { success, message }
 */
function deleteTemplate_service(templateId) {
  try {
    const ss = getSpreadsheet();
    const SHEET_NAME = 'メッセージテンプレート';
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return { success: false, error: 'シートが見つかりません' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('テンプレートID');

    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(templateId)) {
        targetRow = i + 1; // 1-based
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, error: 'テンプレートID ' + templateId + ' が見つかりません' };
    }

    sheet.deleteRow(targetRow);

    Logger.log('[deleteTemplate] ' + templateId + ' を削除しました');
    return { success: true, message: templateId + ' を削除しました' };

  } catch (error) {
    Logger.log('[deleteTemplate] エラー: ' + error.message);
    return { success: false, error: error.message };
  }
}
