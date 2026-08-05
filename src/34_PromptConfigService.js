/**
 * プロンプト設定管理サービス
 *
 * 翻訳プロンプトの取得・更新機能を提供
 */

/**
 * アクティブなプロンプト設定を取得（Web UI用）
 *
 * @return {Object} { success, configs: Array<{key, value, description, active}> }
 */
function getActivePromptConfigs() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PROMPT_CONFIG);

    if (!sheet) {
      return {
        success: false,
        error: 'プロンプト設定シートが見つかりません'
      };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const keyIndex = headers.indexOf('Key');
    const valueIndex = headers.indexOf('Value');
    const descriptionIndex = headers.indexOf('Description');
    const activeIndex = headers.indexOf('Active');

    if (keyIndex === -1 || valueIndex === -1 || descriptionIndex === -1 || activeIndex === -1) {
      return {
        success: false,
        error: 'プロンプト設定シートのヘッダーが不正です'
      };
    }

    const configs = [];

    for (let i = 1; i < data.length; i++) {
      const key = data[i][keyIndex];
      const value = data[i][valueIndex];
      const description = data[i][descriptionIndex];
      const active = data[i][activeIndex];

      // アクティブな設定のみ（空行はスキップ）
      if (active === true && key && key.trim() !== '') {
        configs.push({
          key: key,
          value: value || '',
          description: description || '',
          active: active
        });
      }
    }

    Logger.log('✅ プロンプト設定取得成功: ' + configs.length + '件');

    return {
      success: true,
      configs: configs
    };

  } catch (error) {
    Logger.log('❌ プロンプト設定取得エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * プロンプト設定を更新（スプレッドシート + キャッシュ同時更新）
 *
 * @param {string} key - プロンプトキー（例: 'SYSTEM_INSTRUCTION'）
 * @param {string} value - 新しい値
 * @return {Object} { success, message }
 */
function updatePromptConfig(key, value) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PROMPT_CONFIG);

    if (!sheet) {
      return {
        success: false,
        error: 'プロンプト設定シートが見つかりません'
      };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const keyIndex = headers.indexOf('Key');
    const valueIndex = headers.indexOf('Value');

    if (keyIndex === -1 || valueIndex === -1) {
      return {
        success: false,
        error: 'プロンプト設定シートのヘッダーが不正です'
      };
    }

    // 該当するキーの行を探す
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][keyIndex] === key) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        error: 'プロンプトキー "' + key + '" が見つかりません'
      };
    }

    // 1. スプレッドシートを更新
    sheet.getRange(rowIndex + 1, valueIndex + 1).setValue(value);

    // 2. キャッシュも同時更新（重要！）
    const cacheKey = 'PROMPT_' + key;
    PropertiesService.getScriptProperties().setProperty(cacheKey, value);

    Logger.log('✅ プロンプト更新成功: ' + key);
    Logger.log('  - スプレッドシート更新: 完了');
    Logger.log('  - キャッシュ更新: ' + cacheKey);

    return {
      success: true,
      message: 'プロンプト設定を更新しました（即座に反映）',
      key: key
    };

  } catch (error) {
    Logger.log('❌ プロンプト更新エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 複数のプロンプト設定を一括更新
 *
 * @param {Array<{key, value}>} configs - 更新するプロンプト設定の配列
 * @return {Object} { success, updatedCount, message }
 */
function updateMultiplePromptConfigs(configs) {
  try {
    if (!Array.isArray(configs) || configs.length === 0) {
      return {
        success: false,
        error: '更新するプロンプト設定がありません'
      };
    }

    let updatedCount = 0;
    const errors = [];

    configs.forEach(config => {
      const result = updatePromptConfig(config.key, config.value);
      if (result.success) {
        updatedCount++;
      } else {
        errors.push(config.key + ': ' + result.error);
      }
    });

    if (errors.length > 0) {
      Logger.log('⚠️ 一部のプロンプト更新に失敗:');
      errors.forEach(err => Logger.log('  - ' + err));
    }

    return {
      success: updatedCount > 0,
      updatedCount: updatedCount,
      totalCount: configs.length,
      errors: errors.length > 0 ? errors : undefined,
      message: updatedCount + '件のプロンプト設定を更新しました'
    };

  } catch (error) {
    Logger.log('❌ 一括更新エラー: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * プロンプト設定を削除
 *
 * @param {string} key - 削除するプロンプト設定のキー
 * @return {Object} { success, message, error }
 */
function deletePromptConfig(key) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PROMPT_CONFIG);

    if (!sheet) {
      return { success: false, error: 'プロンプト設定シートが見つかりません' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const keyIndex = headers.indexOf('Key');

    for (let i = 1; i < data.length; i++) {
      if (data[i][keyIndex] === key) {
        sheet.deleteRow(i + 1);
        Logger.log('✅ プロンプト設定削除: ' + key);
        return { success: true, message: key + ' を削除しました' };
      }
    }

    return { success: false, error: 'キー ' + key + ' が見つかりません' };
  } catch (e) {
    Logger.log('❌ deletePromptConfig エラー: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * プロンプトキャッシュを手動でクリア
 *
 * @return {Object} { success, clearedCount }
 */
function clearAllPromptCache() {
  return clearPromptCache();
}
