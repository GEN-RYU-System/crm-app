/**
 * スタッフ管理サービス
 * スタッフ管理と権限設定シートのCRUD操作を提供
 */

/**
 * 担当者マスタのヘッダー配列から列インデックスを取得する。
 * 新名（英語スネークケース）で検索し、見つからなければ旧名（日本語）でフォールバックする。
 * @param {Array} headers - ヘッダー配列
 * @param {string} newName - 新しいヘッダー名
 * @param {string} oldName - 旧ヘッダー名（フォールバック用）
 * @returns {number} 列インデックス（見つからない場合は -1）
 */
function _staffHeaderIdx(headers, newName, oldName) {
  var idx = headers.indexOf(newName);
  return idx !== -1 ? idx : headers.indexOf(oldName);
}

/**
 * スタッフ管理の全データを取得
 * @returns {Object} { success: boolean, data: Array, headers: Array }
 */
function getStaffList() {
  try {
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet || staffSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません'
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];

    // ヘッダー行を除いたデータを取得
    const staffData = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    return {
      success: true,
      headers: headers,
      data: staffData,
      totalCount: staffData.length
    };
  } catch (error) {
    Logger.log('getStaffList error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 権限設定シートの全データを取得
 * @returns {Object} { success: boolean, data: Array, headers: Array }
 */
function getPermissionsList() {
  try {
    const ss = getSpreadsheet();
    const permSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

    if (!permSheet || permSheet.getLastRow() < 2) {
      return {
        success: false,
        error: '権限設定シートが見つかりません'
      };
    }

    const data = permSheet.getDataRange().getValues();
    const headers = data[0];

    // ヘッダー行を除いたデータを取得
    const permData = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    return {
      success: true,
      headers: headers,
      data: permData,
      totalCount: permData.length
    };
  } catch (error) {
    Logger.log('getPermissionsList error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * スタッフ管理の1行を更新
 * @param {string} staffId - 担当者ID
 * @param {Object} updates - 更新内容（列名: 値のオブジェクト）
 * @returns {Object} { success: boolean, message: string }
 */
function updateStaff(staffId, updates) {
  try {
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet || staffSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません'
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];
    const staffIdIdx = headers.indexOf('担当者ID');

    if (staffIdIdx === -1) {
      return {
        success: false,
        error: '担当者ID列が見つかりません'
      };
    }

    // 担当者IDで該当行を検索
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][staffIdIdx] === staffId) {
        targetRow = i + 1; // シートの行番号（1-indexed）
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        error: '担当者ID「' + staffId + '」が見つかりません'
      };
    }

    // 更新対象の列を特定して値を設定
    let updateCount = 0;
    Object.keys(updates).forEach(columnName => {
      const colIdx = headers.indexOf(columnName);
      if (colIdx !== -1) {
        staffSheet.getRange(targetRow, colIdx + 1).setValue(updates[columnName]);
        updateCount++;
      }
    });

    return {
      success: true,
      message: staffId + ' を更新しました（' + updateCount + '項目）',
      updatedCount: updateCount
    };
  } catch (error) {
    Logger.log('updateStaff error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 権限設定シートの1行を更新
 * @param {string} roleName - 役割名
 * @param {Object} updates - 更新内容（列名: 値のオブジェクト）
 * @returns {Object} { success: boolean, message: string }
 */
function updatePermission(roleName, updates) {
  try {
    const ss = getSpreadsheet();
    const permSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

    if (!permSheet || permSheet.getLastRow() < 2) {
      return {
        success: false,
        error: '権限設定シートが見つかりません'
      };
    }

    const data = permSheet.getDataRange().getValues();
    const headers = data[0];
    const roleIdx = headers.indexOf('役割名');

    if (roleIdx === -1) {
      return {
        success: false,
        error: '役割名列が見つかりません'
      };
    }

    // 役割名で該当行を検索
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][roleIdx] === roleName) {
        targetRow = i + 1; // シートの行番号（1-indexed）
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        error: '役割名「' + roleName + '」が見つかりません'
      };
    }

    // 更新対象の列を特定して値を設定
    let updateCount = 0;
    Object.keys(updates).forEach(columnName => {
      const colIdx = headers.indexOf(columnName);
      if (colIdx !== -1) {
        // boolean値の場合は TRUE/FALSE として保存
        let value = updates[columnName];
        if (typeof value === 'boolean') {
          value = value ? 'TRUE' : 'FALSE';
        }
        permSheet.getRange(targetRow, colIdx + 1).setValue(value);
        updateCount++;
      }
    });

    return {
      success: true,
      message: roleName + ' の権限を更新しました（' + updateCount + '項目）',
      updatedCount: updateCount
    };
  } catch (error) {
    Logger.log('updatePermission error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 新しい担当者を追加
 * @param {Object} staffData - 担当者データ（列名: 値のオブジェクト）
 * @returns {Object} { success: boolean, staffId: string, message: string }
 */
function addStaff(staffData) {
  try {
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません'
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];

    // 担当者IDを自動生成（既存の最大値+1）
    const staffIdIdx = headers.indexOf('担当者ID');
    let maxId = 0;

    if (staffIdIdx !== -1) {
      for (let i = 1; i < data.length; i++) {
        const currentId = String(data[i][staffIdIdx]);
        if (currentId.startsWith(CONFIG.STAFF_ID_PREFIX)) {
          const num = parseInt(currentId.replace(CONFIG.STAFF_ID_PREFIX, ''), 10);
          if (num > maxId) {
            maxId = num;
          }
        }
      }
    }

    const newStaffId = CONFIG.STAFF_ID_PREFIX + String(maxId + 1).padStart(5, '0');

    // 新しい行のデータを構築
    const newRow = [];
    headers.forEach(header => {
      if (header === '担当者ID') {
        newRow.push(newStaffId);
      } else if (staffData[header] !== undefined) {
        newRow.push(staffData[header]);
      } else {
        newRow.push(''); // 未指定の列は空白
      }
    });

    // 新しい行を追加
    staffSheet.appendRow(newRow);

    return {
      success: true,
      staffId: newStaffId,
      message: '担当者「' + newStaffId + '」を追加しました'
    };
  } catch (error) {
    Logger.log('addStaff error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 担当者を削除（ステータスを「無効」に変更）
 * @param {string} staffId - 担当者ID
 * @returns {Object} { success: boolean, message: string }
 */
function deleteStaff(staffId) {
  try {
    // 物理削除ではなく、ステータスを「無効」に変更
    const result = updateStaff(staffId, { 'ステータス': '無効' });

    if (result.success) {
      result.message = '担当者「' + staffId + '」を無効化しました';
    }

    return result;
  } catch (error) {
    Logger.log('deleteStaff error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 現在のユーザーのダークモード設定を取得
 * @returns {Object} { success: boolean, darkMode: boolean }
 */
function getUserDarkMode() {
  try {
    const userEmail = resolveCurrentUserEmail();
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet || staffSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません'
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];
    const emailIdx = _staffHeaderIdx(headers, 'email', 'メール');
    const darkModeIdx = _staffHeaderIdx(headers, 'dark_mode', 'ダークモード');

    if (emailIdx === -1) {
      return {
        success: false,
        error: 'メールアドレス列が見つかりません'
      };
    }

    // ダークモード列がない場合は追加
    if (darkModeIdx === -1) {
      staffSheet.getRange(1, headers.length + 1).setValue('dark_mode');
      Logger.log('ダークモード列を追加しました');
      return {
        success: true,
        darkMode: false // デフォルトはfalse
      };
    }

    // ユーザーを検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIdx] === userEmail) {
        const darkModeValue = data[i][darkModeIdx];
        const darkMode = darkModeValue === true || darkModeValue === 'TRUE' || darkModeValue === 'true';

        Logger.log('getUserDarkMode: ' + userEmail + ' -> ' + darkMode);
        return {
          success: true,
          darkMode: darkMode
        };
      }
    }

    // ユーザーが見つからない場合
    return {
      success: false,
      error: 'ユーザー「' + userEmail + '」がスタッフ管理に見つかりません'
    };
  } catch (error) {
    Logger.log('getUserDarkMode error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 現在のユーザーのダークモード設定を更新
 * @param {boolean} darkMode - ダークモード設定（true/false）
 * @returns {Object} { success: boolean, message: string }
 */
function updateUserDarkMode(darkMode) {
  try {
    const userEmail = resolveCurrentUserEmail();
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet || staffSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません'
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];
    const emailIdx = _staffHeaderIdx(headers, 'email', 'メール');
    let darkModeIdx = _staffHeaderIdx(headers, 'dark_mode', 'ダークモード');

    if (emailIdx === -1) {
      return {
        success: false,
        error: 'メールアドレス列が見つかりません'
      };
    }

    // ダークモード列がない場合は追加
    if (darkModeIdx === -1) {
      staffSheet.getRange(1, headers.length + 1).setValue('dark_mode');
      darkModeIdx = headers.length;
      Logger.log('ダークモード列を追加しました');
    }

    // ユーザーを検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIdx] === userEmail) {
        const targetRow = i + 1; // シートの行番号（1-indexed）
        const value = darkMode ? 'TRUE' : 'FALSE';
        staffSheet.getRange(targetRow, darkModeIdx + 1).setValue(value);

        Logger.log('updateUserDarkMode: ' + userEmail + ' -> ' + value);
        return {
          success: true,
          message: 'ダークモード設定を更新しました'
        };
      }
    }

    // ユーザーが見つからない場合
    return {
      success: false,
      error: 'ユーザー「' + userEmail + '」がスタッフ管理に見つかりません'
    };
  } catch (error) {
    Logger.log('updateUserDarkMode error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 現在のユーザーのメニュー表示設定を取得
 * @returns {Object} { success: boolean, menuPreferences: Object }
 */
function getUserMenuPreferences() {
  try {
    const userEmail = resolveCurrentUserEmail();
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet || staffSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません'
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];
    const emailIdx = _staffHeaderIdx(headers, 'email', 'メール');
    const chatMenuIdx = _staffHeaderIdx(headers, 'chat_menu_visible', 'チャットメニュー表示');
    const salesMenuIdx = _staffHeaderIdx(headers, 'sales_menu_visible', '営業メニュー表示');
    const settingsMenuIdx = _staffHeaderIdx(headers, 'settings_menu_visible', '設定メニュー表示');
    const buddyMenuIdx = _staffHeaderIdx(headers, 'buddy_maintenance_menu_visible', 'Buddyメンテナンスメニュー表示');
    const adminMenuIdx = _staffHeaderIdx(headers, 'admin_menu_visible', '管理者メニュー表示');

    if (emailIdx === -1) {
      return {
        success: false,
        error: 'メールアドレス列が見つかりません'
      };
    }

    // メニュー設定列がない場合はデフォルト値を返す
    if (chatMenuIdx === -1 || salesMenuIdx === -1 || settingsMenuIdx === -1 || buddyMenuIdx === -1 || adminMenuIdx === -1) {
      Logger.log('⚠️ Menu preference columns not found. Returning defaults.');
      return {
        success: true,
        menuPreferences: {
          chat: true,
          sales: true,
          settings: true,
          buddyMaintenance: true,
          admin: true
        }
      };
    }

    // ユーザーを検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIdx] === userEmail) {
        const chatMenu = data[i][chatMenuIdx] === true || data[i][chatMenuIdx] === 'TRUE' || data[i][chatMenuIdx] === 'true';
        const salesMenu = data[i][salesMenuIdx] === true || data[i][salesMenuIdx] === 'TRUE' || data[i][salesMenuIdx] === 'true';
        const settingsMenu = data[i][settingsMenuIdx] === true || data[i][settingsMenuIdx] === 'TRUE' || data[i][settingsMenuIdx] === 'true';
        const buddyMenu = data[i][buddyMenuIdx] === true || data[i][buddyMenuIdx] === 'TRUE' || data[i][buddyMenuIdx] === 'true';
        const adminMenu = data[i][adminMenuIdx] === true || data[i][adminMenuIdx] === 'TRUE' || data[i][adminMenuIdx] === 'true';

        Logger.log('getUserMenuPreferences: ' + userEmail + ' -> chat:' + chatMenu + ', sales:' + salesMenu + ', settings:' + settingsMenu + ', buddy:' + buddyMenu + ', admin:' + adminMenu);

        return {
          success: true,
          menuPreferences: {
            chat: chatMenu,
            sales: salesMenu,
            settings: settingsMenu,
            buddyMaintenance: buddyMenu,
            admin: adminMenu
          }
        };
      }
    }

    // ユーザーが見つからない場合
    return {
      success: false,
      error: 'ユーザー「' + userEmail + '」がスタッフ管理に見つかりません'
    };

  } catch (error) {
    Logger.log('getUserMenuPreferences error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * 現在のユーザーのメニュー表示設定を更新
 * @param {Object} menuPreferences - メニュー表示設定（{ chat: boolean, sales: boolean, settings: boolean, admin: boolean }）
 * @returns {Object} { success: boolean, message: string }
 */
function updateUserMenuPreferences(menuPreferences) {
  try {
    const userEmail = resolveCurrentUserEmail();
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet || staffSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません'
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];
    const emailIdx = _staffHeaderIdx(headers, 'email', 'メール');
    let chatMenuIdx = _staffHeaderIdx(headers, 'chat_menu_visible', 'チャットメニュー表示');
    let salesMenuIdx = _staffHeaderIdx(headers, 'sales_menu_visible', '営業メニュー表示');
    let settingsMenuIdx = _staffHeaderIdx(headers, 'settings_menu_visible', '設定メニュー表示');
    let buddyMenuIdx = _staffHeaderIdx(headers, 'buddy_maintenance_menu_visible', 'Buddyメンテナンスメニュー表示');
    let adminMenuIdx = _staffHeaderIdx(headers, 'admin_menu_visible', '管理者メニュー表示');

    if (emailIdx === -1) {
      return {
        success: false,
        error: 'メールアドレス列が見つかりません'
      };
    }

    // メニュー設定列がない場合は追加
    const columnsToAdd = [];
    if (chatMenuIdx === -1) columnsToAdd.push('chat_menu_visible');
    if (salesMenuIdx === -1) columnsToAdd.push('sales_menu_visible');
    if (settingsMenuIdx === -1) columnsToAdd.push('settings_menu_visible');
    if (buddyMenuIdx === -1) columnsToAdd.push('buddy_maintenance_menu_visible');
    if (adminMenuIdx === -1) columnsToAdd.push('admin_menu_visible');

    if (columnsToAdd.length > 0) {
      const lastColumn = staffSheet.getLastColumn();
      columnsToAdd.forEach((columnName, index) => {
        staffSheet.getRange(1, lastColumn + 1 + index).setValue(columnName);
      });
      Logger.log('メニュー設定列を追加しました: ' + columnsToAdd.join(', '));

      // インデックスを再取得
      const newHeaders = staffSheet.getRange(1, 1, 1, staffSheet.getLastColumn()).getValues()[0];
      chatMenuIdx = _staffHeaderIdx(newHeaders, 'chat_menu_visible', 'チャットメニュー表示');
      salesMenuIdx = _staffHeaderIdx(newHeaders, 'sales_menu_visible', '営業メニュー表示');
      settingsMenuIdx = _staffHeaderIdx(newHeaders, 'settings_menu_visible', '設定メニュー表示');
      buddyMenuIdx = _staffHeaderIdx(newHeaders, 'buddy_maintenance_menu_visible', 'Buddyメンテナンスメニュー表示');
      adminMenuIdx = _staffHeaderIdx(newHeaders, 'admin_menu_visible', '管理者メニュー表示');
    }

    // ユーザーを検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIdx] === userEmail) {
        const targetRow = i + 1; // シートの行番号（1-indexed）

        // 各メニュー設定を更新
        if (menuPreferences.chat !== undefined) {
          staffSheet.getRange(targetRow, chatMenuIdx + 1).setValue(menuPreferences.chat ? 'TRUE' : 'FALSE');
        }
        if (menuPreferences.sales !== undefined) {
          staffSheet.getRange(targetRow, salesMenuIdx + 1).setValue(menuPreferences.sales ? 'TRUE' : 'FALSE');
        }
        if (menuPreferences.settings !== undefined) {
          staffSheet.getRange(targetRow, settingsMenuIdx + 1).setValue(menuPreferences.settings ? 'TRUE' : 'FALSE');
        }
        if (menuPreferences.buddyMaintenance !== undefined) {
          staffSheet.getRange(targetRow, buddyMenuIdx + 1).setValue(menuPreferences.buddyMaintenance ? 'TRUE' : 'FALSE');
        }
        if (menuPreferences.admin !== undefined) {
          staffSheet.getRange(targetRow, adminMenuIdx + 1).setValue(menuPreferences.admin ? 'TRUE' : 'FALSE');
        }

        Logger.log('updateUserMenuPreferences: ' + userEmail + ' -> ' + JSON.stringify(menuPreferences));

        return {
          success: true,
          message: 'メニュー表示設定を更新しました'
        };
      }
    }

    // ユーザーが見つからない場合
    return {
      success: false,
      error: 'ユーザー「' + userEmail + '」がスタッフ管理に見つかりません'
    };

  } catch (error) {
    Logger.log('updateUserMenuPreferences error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}

/**
 * ユーザーのサイドバー表示設定を取得
 * @param {string} userEmail - ユーザーのメールアドレス
 * @returns {Object} { success: boolean, sidebarOpen: boolean }
 */
function getUserSidebarPreference(userEmail) {
  try {
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet || staffSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません',
        sidebarOpen: true // デフォルト値
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];

    // 列インデックスを取得
    const emailIdx = _staffHeaderIdx(headers, 'email', 'メール');
    const sidebarIdx = _staffHeaderIdx(headers, 'sidebar_visible', 'サイドバー表示');

    if (emailIdx === -1) {
      Logger.log('getUserSidebarPreference: メール列が見つかりません');
      return {
        success: false,
        error: 'メール列が見つかりません',
        sidebarOpen: true // デフォルト値
      };
    }

    if (sidebarIdx === -1) {
      Logger.log('getUserSidebarPreference: サイドバー表示列が見つかりません');
      return {
        success: false,
        error: 'サイドバー表示列が見つかりません',
        sidebarOpen: true // デフォルト値
      };
    }

    // ユーザーを検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIdx] === userEmail) {
        const sidebarValue = data[i][sidebarIdx];

        // TRUE/FALSE、true/false、1/0、"TRUE"/"FALSE" などに対応
        let sidebarOpen = true; // デフォルト

        if (typeof sidebarValue === 'boolean') {
          sidebarOpen = sidebarValue;
        } else if (typeof sidebarValue === 'string') {
          sidebarOpen = sidebarValue.toUpperCase() === 'TRUE';
        } else if (typeof sidebarValue === 'number') {
          sidebarOpen = sidebarValue !== 0;
        }

        Logger.log('getUserSidebarPreference: ' + userEmail + ' -> ' + sidebarOpen);

        return {
          success: true,
          sidebarOpen: sidebarOpen
        };
      }
    }

    // ユーザーが見つからない場合
    Logger.log('getUserSidebarPreference: ユーザーが見つかりません -> ' + userEmail);
    return {
      success: false,
      error: 'ユーザー「' + userEmail + '」がスタッフ管理に見つかりません',
      sidebarOpen: true // デフォルト値
    };

  } catch (error) {
    Logger.log('getUserSidebarPreference error: ' + error);
    return {
      success: false,
      error: error.message || error.toString(),
      sidebarOpen: true // デフォルト値
    };
  }
}

/**
 * ユーザーのサイドバー表示設定を更新
 * @param {string} userEmail - ユーザーのメールアドレス
 * @param {boolean} sidebarOpen - サイドバーを開くかどうか
 * @returns {Object} { success: boolean, message: string }
 */
function updateUserSidebarPreference(userEmail, sidebarOpen) {
  try {
    const ss = getSpreadsheet();
    const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

    if (!staffSheet || staffSheet.getLastRow() < 2) {
      return {
        success: false,
        error: 'スタッフ管理シートが見つかりません'
      };
    }

    const data = staffSheet.getDataRange().getValues();
    const headers = data[0];

    // 列インデックスを取得
    const emailIdx = _staffHeaderIdx(headers, 'email', 'メール');
    const sidebarIdx = _staffHeaderIdx(headers, 'sidebar_visible', 'サイドバー表示');

    if (emailIdx === -1) {
      return {
        success: false,
        error: 'メール列が見つかりません'
      };
    }

    if (sidebarIdx === -1) {
      return {
        success: false,
        error: 'サイドバー表示列が見つかりません'
      };
    }

    // ユーザーを検索して更新
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailIdx] === userEmail) {
        const targetRow = i + 1; // シートの行番号（1-indexed）

        // サイドバー表示設定を更新
        staffSheet.getRange(targetRow, sidebarIdx + 1).setValue(sidebarOpen);

        Logger.log('updateUserSidebarPreference: ' + userEmail + ' -> ' + sidebarOpen);

        return {
          success: true,
          message: 'サイドバー表示設定を更新しました'
        };
      }
    }

    // ユーザーが見つからない場合
    return {
      success: false,
      error: 'ユーザー「' + userEmail + '」がスタッフ管理に見つかりません'
    };

  } catch (error) {
    Logger.log('updateUserSidebarPreference error: ' + error);
    return {
      success: false,
      error: error.message || error.toString()
    };
  }
}
