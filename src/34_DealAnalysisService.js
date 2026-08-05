/**
 * 商談解析サービス
 * Gemini APIを使用してメッセージから商談状況を分析
 */

/**
 * メッセージから商談を解析
 * @param {string} leadId - リードID
 * @param {string} logId - ログID
 * @param {string} messageText - メッセージテキスト（翻訳文 or 原文）
 * @returns {Object} 解析結果
 */
function analyzeDealFromMessage(leadId, logId, messageText) {
  try {
    // Gemini APIキーを取得
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    if (!apiKey) {
      Logger.log('GEMINI_API_KEYが設定されていません');
      return {
        success: false,
        message: '商談解析にはGemini APIキーの設定が必要です。'
      };
    }

    // リード情報を取得
    const leadInfo = getLeadInfo(leadId);
    if (!leadInfo) {
      return {
        success: false,
        message: 'リード情報が見つかりません。'
      };
    }

    // 会話履歴を取得（コンテキストのため）
    const conversationHistory = getConversationHistory(leadId, logId);

    // プロンプトを構築
    const prompt = buildDealAnalysisPrompt(messageText, leadInfo, conversationHistory);

    // Gemini APIを呼び出し
    const response = callGeminiAPI(prompt, apiKey);

    if (response && response.candidates && response.candidates[0]) {
      const text = response.candidates[0].content.parts[0].text;
      const analysis = parseDealAnalysis(text);

      // 会話ログシートに解析結果を保存
      const saveResult = saveDealAnalysis(logId, analysis.fullText);

      if (saveResult.success) {
        return {
          success: true,
          analysis: analysis,
          dealMemo: analysis.fullText,
          message: '商談解析が完了しました。'
        };
      } else {
        return {
          success: false,
          message: '解析結果の保存に失敗しました。'
        };
      }
    }

    return {
      success: false,
      message: '商談解析に失敗しました。'
    };

  } catch (error) {
    Logger.log('商談解析エラー: ' + error.message);
    Logger.log(error.stack);
    return {
      success: false,
      message: '商談解析中にエラーが発生しました: ' + error.message
    };
  }
}

/**
 * リード情報を取得
 * @param {string} leadId - リードID
 * @returns {Object|null} リード情報
 */
function getLeadInfo(leadId) {
  const ss = getSpreadsheet();
  const sheet = getSheetByGid(ss, CONFIG.SHEETS.LEADS_GID);

  if (!sheet) {
    Logger.log('リード管理シートが見つかりません');
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const leadIdIdx = headers.indexOf('リードID');

  if (leadIdIdx === -1) {
    Logger.log('リードID列が見つかりません');
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      const leadInfo = {};
      headers.forEach((header, idx) => {
        leadInfo[header] = data[i][idx];
      });
      return leadInfo;
    }
  }

  return null;
}

/**
 * 会話履歴を取得（コンテキストのため、最新5件）
 * @param {string} leadId - リードID
 * @param {string} currentLogId - 現在のログID（これは除外）
 * @returns {Array} 会話履歴
 */
function getConversationHistory(leadId, currentLogId) {
  const ss = getSpreadsheet();
  const logSheet = ss.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG);

  if (!logSheet) {
    Logger.log('会話ログシートが見つかりません');
    return [];
  }

  const data = logSheet.getDataRange().getValues();
  const headers = data[0];
  const logIdIdx = headers.indexOf('ログID');
  const leadIdIdx = headers.indexOf('リードID');
  const dateIdx = headers.indexOf('日時');
  const directionIdx = headers.indexOf('送受信');
  const textIdx = headers.indexOf('翻訳文');
  const originalIdx = headers.indexOf('原文');

  const history = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[leadIdIdx] === leadId && row[logIdIdx] !== currentLogId) {
      history.push({
        date: row[dateIdx],
        direction: row[directionIdx],
        text: row[textIdx] || row[originalIdx]
      });
    }
  }

  // 日時でソート（新しい順）
  history.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 最新5件を取得
  return history.slice(0, 5).reverse(); // 古い順に並べ直す
}

/**
 * 商談解析用プロンプトを構築
 * @param {string} messageText - 現在のメッセージ
 * @param {Object} leadInfo - リード情報
 * @param {Array} history - 会話履歴
 * @returns {string} プロンプト
 */
function buildDealAnalysisPrompt(messageText, leadInfo, history) {
  const historyText = history.length > 0
    ? history.map(h => `[${h.direction}] ${h.text}`).join('\n')
    : 'なし';

  const prompt = `
あなたは経験豊富な営業コンサルタントです。
以下の会話内容から商談の状況を分析し、営業担当者がとるべきアクションを提案してください。

【顧客情報】
- 顧客名: ${leadInfo['顧客名'] || '不明'}
- 国: ${leadInfo['国'] || '不明'}
- リード種別: ${leadInfo['リード種別'] || '不明'}
- リード進捗: ${leadInfo['リード進捗'] || '不明'}

【過去の会話履歴】
${historyText}

【今回のメッセージ】
${messageText}

【分析項目】
以下の形式で出力してください：

## 相手の心境
（顧客の現在の心理状態や興味度合いを分析。購買意欲、懸念点、期待値などを含む）

## 取るべきアクション
（営業担当者が次に取るべき具体的なアクションを3-5つリストアップ）
1.
2.
3.

## ヒアリングすべき項目
（商談を進めるために確認すべき情報を3-5つリストアップ）
1.
2.
3.

---

**重要な注意事項:**
- 事実に基づいた分析のみを行う
- 推測の場合は「〜と推測されます」と明記する
- 具体的で実行可能なアクションを提案する
- 顧客の文化や商習慣（国によって異なる）を考慮する
`;

  return prompt;
}

/**
 * Geminiの応答をパース
 * @param {string} text - 応答テキスト
 * @returns {Object} パース結果
 */
function parseDealAnalysis(text) {
  try {
    // セクションを抽出
    const sections = {
      customerMood: extractSection(text, '相手の心境', '取るべきアクション'),
      actions: extractSection(text, '取るべきアクション', 'ヒアリングすべき項目'),
      hearingItems: extractSection(text, 'ヒアリングすべき項目', '---'),
      fullText: text.trim()
    };

    return sections;

  } catch (error) {
    Logger.log('パースエラー: ' + error.message);
    return {
      customerMood: '',
      actions: '',
      hearingItems: '',
      fullText: text
    };
  }
}

/**
 * テキストからセクションを抽出
 * @param {string} text - 全体テキスト
 * @param {string} startMarker - 開始マーカー
 * @param {string} endMarker - 終了マーカー
 * @returns {string} 抽出されたセクション
 */
function extractSection(text, startMarker, endMarker) {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';

  const endIdx = endMarker ? text.indexOf(endMarker, startIdx) : text.length;
  if (endIdx === -1) return text.substring(startIdx).trim();

  return text.substring(startIdx, endIdx).trim();
}

/**
 * 商談解析結果を会話ログシートに保存
 * @param {string} logId - ログID
 * @param {string} analysisText - 解析結果テキスト
 * @returns {Object} 保存結果
 */
function saveDealAnalysis(logId, analysisText) {
  try {
    const ss = getSpreadsheet();
    const logSheet = ss.getSheetByName(CONFIG.SHEETS.CONVERSATION_LOG);

    if (!logSheet) {
      return {
        success: false,
        message: '会話ログシートが見つかりません'
      };
    }

    const data = logSheet.getDataRange().getValues();
    const headers = data[0];
    const logIdIdx = headers.indexOf('ログID');
    const analysisIdx = headers.indexOf('商談解析');

    if (logIdIdx === -1) {
      return {
        success: false,
        message: 'ログID列が見つかりません'
      };
    }

    if (analysisIdx === -1) {
      return {
        success: false,
        message: '商談解析列が見つかりません。シートに列を追加してください。'
      };
    }

    // 該当する行を見つけて更新
    for (let i = 1; i < data.length; i++) {
      if (data[i][logIdIdx] === logId) {
        logSheet.getRange(i + 1, analysisIdx + 1).setValue(analysisText);
        Logger.log('商談解析を保存しました: ' + logId);
        return {
          success: true,
          message: '商談解析を保存しました'
        };
      }
    }

    return {
      success: false,
      message: '該当するログIDが見つかりません: ' + logId
    };

  } catch (error) {
    Logger.log('保存エラー: ' + error.message);
    return {
      success: false,
      message: '保存中にエラーが発生しました: ' + error.message
    };
  }
}

/**
 * テスト関数：商談解析
 */
function testAnalyzeDeal() {
  const result = analyzeDealFromMessage(
    'LDI-00001',  // リードID
    'LOG-00001',  // ログID
    'こんにちは。御社のポケモンカードの在庫状況を教えていただけますでしょうか？特にM3のシュリンク付きボックスを探しています。'
  );

  Logger.log(JSON.stringify(result, null, 2));
}
