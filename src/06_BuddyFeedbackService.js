/**
 * Buddyフィードバックサービス
 * Gemini APIを使用した商談フィードバック生成
 */

/**
 * 商談フィードバックを生成
 * @param {Object} reportData - 商談レポートデータ
 * @param {string} conversationLog - 会話ログ
 * @returns {Object} フィードバック結果
 */
function generateDealFeedback(reportData, conversationLog) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    Logger.log('GEMINI_API_KEYが設定されていません');
    return {
      success: false,
      buddyMessage: 'フィードバック生成にはGemini APIキーの設定が必要です。'
    };
  }

  const prompt = buildFeedbackPrompt(reportData, conversationLog);

  try {
    const response = callGeminiAPI(prompt, apiKey);

    if (response && response.candidates && response.candidates[0]) {
      const text = response.candidates[0].content.parts[0].text;
      const feedback = parseGeminiFeedback(text);
      return {
        success: true,
        ...feedback
      };
    }

    return {
      success: false,
      buddyMessage: 'フィードバックの生成に失敗しました。'
    };

  } catch (error) {
    Logger.log('Gemini API エラー: ' + error.message);
    return {
      success: false,
      buddyMessage: 'フィードバック生成中にエラーが発生しました。'
    };
  }
}

/**
 * フィードバック用プロンプトを構築
 * @param {Object} reportData - レポートデータ
 * @param {string} conversationLog - 会話ログ
 * @returns {string} プロンプト
 */
function buildFeedbackPrompt(reportData, conversationLog) {
  const prompt = `
あなたは「Buddy」という営業コーチAIです。
営業担当者の商談レポートを読み、建設的なフィードバックを提供してください。

【ルール】
- 事実（データ）に基づいた発言のみ
- 予測や主観的評価は禁止
- 共感 + 事実提示 + 質問の形式
- 短く、実践的なアドバイスを心がける
- ポジティブな点を先に挙げ、改善点は具体的に

【商談レポート】
- 商談結果: ${reportData.dealResult || '未設定'}
- 顧客名: ${reportData.customerName || '未設定'}
- 取り扱い商材: ${Array.isArray(reportData.products) ? reportData.products.join(', ') : (reportData.products || '未設定')}
- 販売先: ${Array.isArray(reportData.salesChannels) ? reportData.salesChannels.join(', ') : (reportData.salesChannels || '未設定')}
- 顧客タイプ: ${reportData.customerType || '未設定'}
- 1回の発注金額: ${reportData.orderAmount || '未設定'}
- 購入頻度: ${reportData.purchaseFrequency || '未設定'}
- 見込度: ${reportData.prospectLevel || '未設定'}/5
- 商談の手応え: ${reportData.dealFeeling || '未設定'}/5
- 良かった点: ${reportData.goodPoints || '未入力'}
- 成約ポイント: ${reportData.successPoints || '未入力'}
- 改善点: ${reportData.improvements || '未入力'}
- アクションプラン: ${reportData.actionPlan || '未入力'}

${conversationLog ? '【会話ログ】\n' + conversationLog : ''}

【出力形式】
以下のJSON形式で出力してください。日本語で記述してください。

{
  "customerReaction": "ポジティブ/ネガティブ/ニュートラル",
  "keyPoints": ["キーポイント1", "キーポイント2"],
  "goodPoints": ["良かった点1", "良かった点2"],
  "improvements": ["改善点1", "改善点2"],
  "buddyMessage": "Buddyからのメッセージ（3-4文、親しみやすく励ましながらも具体的なアドバイスを含める）"
}
`;

  return prompt;
}

/**
 * Gemini APIを呼び出し
 * @param {string} prompt - プロンプト
 * @param {string} apiKey - APIキー
 * @returns {Object} APIレスポンス
 */
function callGeminiAPI(prompt, apiKey) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.95
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error('Gemini API error: ' + responseCode + ' - ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

/**
 * Geminiの応答をパース
 * @param {string} text - 応答テキスト
 * @returns {Object} パース結果
 */
function parseGeminiFeedback(text) {
  try {
    // JSON部分を抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        customerReaction: parsed.customerReaction || 'ニュートラル',
        keyPoints: parsed.keyPoints || [],
        goodPoints: parsed.goodPoints || [],
        improvements: parsed.improvements || [],
        buddyMessage: parsed.buddyMessage || 'お疲れ様です！レポートを確認しました。'
      };
    }
  } catch (e) {
    Logger.log('JSON解析エラー: ' + e.message);
  }

  // JSONパースに失敗した場合はテキストそのままを使用
  return {
    customerReaction: 'ニュートラル',
    keyPoints: [],
    goodPoints: [],
    improvements: [],
    buddyMessage: text.substring(0, 300) // 最初の300文字
  };
}

/**
 * 会話ログを解析
 * @param {string} log - 会話ログ
 * @returns {Object} 解析結果
 */
function analyzeConversationLog(log) {
  if (!log) {
    return {
      wordCount: 0,
      lineCount: 0,
      keywords: [],
      sentiment: 'neutral'
    };
  }

  const lines = log.split('\n').filter(l => l.trim());
  const words = log.split(/\s+/).filter(w => w);

  // 簡易的なキーワード抽出（実際にはGeminiで行うことも可能）
  const keywords = [];
  const keywordPatterns = ['価格', '品質', '納期', '在庫', '送料', '競合', 'リピート', '問題', '要望'];

  keywordPatterns.forEach(kw => {
    if (log.includes(kw)) {
      keywords.push(kw);
    }
  });

  return {
    wordCount: words.length,
    lineCount: lines.length,
    keywords: keywords,
    sentiment: 'neutral' // 実際にはAIで判定
  };
}

/**
 * Buddyチャット応答を生成
 * @param {string} userMessage - ユーザーメッセージ
 * @param {string} staffId - 担当者ID
 * @param {string} context - コンテキスト（商談ID等）
 * @returns {Object} 応答結果
 */
function generateBuddyChatResponse(userMessage, staffId, context) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    return {
      success: false,
      message: 'APIキーが設定されていません。'
    };
  }

  // コンテキスト情報を取得
  let contextInfo = '';
  if (context && context.dealId) {
    const dealData = getDealDataForReport(context.dealId);
    if (dealData) {
      contextInfo = `
【現在の商談情報】
- 顧客名: ${dealData['顧客名']}
- ステータス: ${dealData['進捗ステータス']}
- 取り扱い: ${dealData['取り扱いタイトル']}
`;
    }
  }

  const prompt = `
あなたは「Buddy」という営業コーチAIです。
営業担当者からの相談に、親しみやすく、実践的なアドバイスで応えてください。

【ルール】
- 事実に基づいた発言のみ
- 共感を示しつつ、具体的なアドバイスを
- 短く、明確に（3-4文程度）
- 必要に応じて質問で掘り下げる

${contextInfo}

【ユーザーの相談】
${userMessage}

【応答】
`;

  try {
    const response = callGeminiAPI(prompt, apiKey);

    if (response && response.candidates && response.candidates[0]) {
      const text = response.candidates[0].content.parts[0].text;

      // ログを保存
      saveBuddyDialogLog(staffId, userMessage, text, context ? JSON.stringify(context) : '', null);

      return {
        success: true,
        message: text
      };
    }

    return {
      success: false,
      message: '応答の生成に失敗しました。'
    };

  } catch (error) {
    Logger.log('Buddy応答エラー: ' + error.message);
    return {
      success: false,
      message: '申し訳ありません。一時的にお話しできない状態です。'
    };
  }
}

/**
 * 商談結果に応じたBuddyメッセージテンプレート
 * @param {string} result - 商談結果
 * @returns {string} テンプレートメッセージ
 */
function getBuddyMessageTemplate(result) {
  const templates = {
    '成約': 'おめでとうございます！成約おめでとうございます。今回の成功体験を振り返って、次に活かせるポイントを一緒に整理しましょう。',
    '失注': 'お疲れ様でした。結果は残念でしたが、この経験から学べることがたくさんあります。何が改善できたか、一緒に振り返りましょう。',
    '追客': '良い判断ですね。追客中の案件として、次のアクションを明確にしておくと、タイミングを逃さずにすみます。',
    '見送り': '判断ありがとうございます。見送りの理由を記録しておくと、将来の優先順位付けに役立ちます。',
    '対象外': '確認ありがとうございます。対象外の判断基準を明確にしておくと、今後のリード選別が効率的になりますね。'
  };

  return templates[result] || 'レポートを確認しました。何かお手伝いできることはありますか？';
}
