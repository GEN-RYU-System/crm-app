/**
 * プロンプト管理サービス
 *
 * プロンプト設定を外部化し、キャッシュ機構を提供する
 */

/**
 * プロンプト設定を取得（キャッシュ機構付き）
 *
 * @param {string} key - プロンプト設定のキー（例: 'SYSTEM_INSTRUCTION'）
 * @return {string|null} プロンプト設定の値、見つからない場合はnull
 */
function getPromptConfig(key) {
  const cache = PropertiesService.getScriptProperties();
  const cacheKey = 'PROMPT_' + key;

  // キャッシュチェック
  const cached = cache.getProperty(cacheKey);
  if (cached) {
    Logger.log('🎯 Cache hit: ' + cacheKey);
    return cached;
  }

  // シートから取得
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PROMPT_CONFIG);

  if (!sheet) {
    Logger.log('⚠️ PromptConfig シートが見つかりません');
    return null;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIndex = headers.indexOf('Key');
  const valueIndex = headers.indexOf('Value');
  const activeIndex = headers.indexOf('Active');

  if (keyIndex === -1 || valueIndex === -1 || activeIndex === -1) {
    Logger.log('❌ PromptConfig シートのヘッダーが不正です');
    return null;
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][keyIndex] === key && data[i][activeIndex] === true) {
      const value = data[i][valueIndex];

      // キャッシュに保存（24時間）
      try {
        cache.setProperty(cacheKey, value);
        Logger.log('💾 Cached: ' + cacheKey);
      } catch (e) {
        Logger.log('⚠️ キャッシュ保存失敗: ' + e.message);
      }

      return value;
    }
  }

  Logger.log('⚠️ プロンプト設定が見つかりません: ' + key);
  return null;
}

/**
 * プロンプトキャッシュをクリア
 */
function clearPromptCache() {
  const cache = PropertiesService.getScriptProperties();
  const keys = cache.getKeys();

  let cleared = 0;
  keys.forEach(key => {
    if (key.startsWith('PROMPT_')) {
      cache.deleteProperty(key);
      cleared++;
    }
  });

  Logger.log('✅ プロンプトキャッシュをクリアしました (' + cleared + '件)');

  return {
    success: true,
    clearedCount: cleared
  };
}

/**
 * プロンプトテンプレートの変数を置換
 *
 * @param {string} template - プロンプトテンプレート（例: "{{target_lang}}のネイティブ"）
 * @param {Object} variables - 置換する変数のマップ（例: {target_lang: '日本語'}）
 * @return {string} 変数置換後のプロンプト
 */
function replacePromptVariables(template, variables) {
  if (!template) {
    return '';
  }

  let result = template;

  Object.keys(variables).forEach(key => {
    const placeholder = '{{' + key + '}}';
    const value = variables[key] || '';
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  return result;
}

/**
 * 全プロンプト設定を取得
 *
 * @return {Array<Object>} プロンプト設定の配列
 */
function getAllPromptConfigs() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.PROMPT_CONFIG);

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIndex = headers.indexOf('Key');
  const valueIndex = headers.indexOf('Value');
  const descriptionIndex = headers.indexOf('Description');
  const activeIndex = headers.indexOf('Active');

  const configs = [];

  for (let i = 1; i < data.length; i++) {
    configs.push({
      key: data[i][keyIndex],
      value: data[i][valueIndex],
      description: data[i][descriptionIndex],
      active: data[i][activeIndex]
    });
  }

  return configs;
}

/**
 * プロンプト設定をテスト
 */
function testPromptConfig() {
  Logger.log('========================================');
  Logger.log('📝 プロンプト設定テスト');
  Logger.log('========================================');

  const keys = [
    'SYSTEM_INSTRUCTION',
    'ROLE_TRANSLATOR',
    'ROLE_NATIVE',
    'ROLE_BUSINESS',
    'FORMAT_SPEC',
    'GLOSSARY_INTRO'
  ];

  keys.forEach(key => {
    const value = getPromptConfig(key);
    Logger.log('');
    Logger.log('Key: ' + key);
    Logger.log('Value: ' + (value ? value.substring(0, 100) + '...' : 'NULL'));
  });

  Logger.log('========================================');

  return {
    success: true,
    testedKeys: keys
  };
}
