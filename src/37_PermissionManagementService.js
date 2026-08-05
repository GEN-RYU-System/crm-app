/**
 * 権限管理サービス
 * アプリ内で権限設定を管理
 */

/**
 * 全役割の権限設定を取得
 * @returns {Object} 権限設定データ + 階層構造
 */
function getAllPermissions() {
  try {
    const ss = getSpreadsheet();
    const permSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

    if (!permSheet) {
      throw new Error('権限設定シートが見つかりません');
    }

    const data = permSheet.getDataRange().getValues();
    const headers = data[0];       // 1行目: 権限名
    const parentMenus = data[1];    // 2行目: 親メニュー名

    // ヘッダー情報を構築（種別は親メニューの有無で判定）
    const permissionColumns = [];
    for (let i = 1; i < headers.length; i++) { // 0列目は役割名なのでスキップ
      const parentMenu = parentMenus[i] || '';
      const type = parentMenu ? 'ページ' : 'メニュー'; // 親メニューがあればページ、なければメニュー

      permissionColumns.push({
        key: headers[i],
        type: type,
        parentMenu: parentMenu
      });
    }

    // 権限階層マッピングを構築（メニュー → 配下のページ配列）
    const permissionHierarchy = {};
    for (let i = 1; i < headers.length; i++) {
      const permissionName = headers[i];
      const parentMenu = parentMenus[i] || '';

      if (!parentMenu) {
        // 親メニューがない = メニュー権限の場合は空配列で初期化
        if (!permissionHierarchy[permissionName]) {
          permissionHierarchy[permissionName] = [];
        }
      } else {
        // 親メニューがある = ページ権限の場合は親メニューの配列に追加
        if (!permissionHierarchy[parentMenu]) {
          permissionHierarchy[parentMenu] = [];
        }
        permissionHierarchy[parentMenu].push(permissionName);
      }
    }

    // 各役割の権限を取得（3行目以降）
    const roles = [];
    for (let i = 2; i < data.length; i++) {
      const roleName = data[i][0];
      if (!roleName) continue; // 空行はスキップ

      const permissions = {};
      for (let j = 1; j < headers.length; j++) {
        permissions[headers[j]] = data[i][j] === true;
      }

      roles.push({
        name: roleName,
        permissions: permissions
      });
    }

    Logger.log('✅ 権限データ取得成功');
    Logger.log('  - 権限列数: ' + permissionColumns.length);
    Logger.log('  - 役割数: ' + roles.length);
    Logger.log('  - 階層構造: ' + JSON.stringify(permissionHierarchy));

    return {
      success: true,
      permissionColumns: permissionColumns,
      roles: roles,
      permissionHierarchy: permissionHierarchy
    };

  } catch (error) {
    Logger.log('getAllPermissions ERROR: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 役割の権限を更新
 * @param {string} roleName - 役割名
 * @param {Object} permissions - 権限オブジェクト { 'ダッシュボード': true, ... }
 * @returns {Object} 更新結果
 */
function updateRolePermissions(roleName, permissions) {
  try {
    const ss = getSpreadsheet();
    const permSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

    if (!permSheet) {
      throw new Error('権限設定シートが見つかりません');
    }

    const data = permSheet.getDataRange().getValues();
    const headers = data[0];

    // 役割の行を検索（3行目以降、2行目は親メニュー）
    let roleRowIndex = -1;
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] === roleName) {
        roleRowIndex = i;
        break;
      }
    }

    if (roleRowIndex === -1) {
      throw new Error('役割「' + roleName + '」が見つかりません');
    }

    // 権限を更新
    const rowData = [roleName];
    for (let j = 1; j < headers.length; j++) {
      const permKey = headers[j];
      rowData.push(permissions[permKey] === true);
    }

    // シートに書き込み（1行）
    permSheet.getRange(roleRowIndex + 1, 1, 1, rowData.length).setValues([rowData]);

    Logger.log('✅ 役割「' + roleName + '」の権限を更新しました');

    return {
      success: true,
      message: '役割「' + roleName + '」の権限を更新しました'
    };

  } catch (error) {
    Logger.log('updateRolePermissions ERROR: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 新しい役割を追加
 * @param {string} roleName - 役割名
 * @returns {Object} 追加結果
 */
function addNewRole(roleName) {
  try {
    const ss = getSpreadsheet();
    const permSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

    if (!permSheet) {
      throw new Error('権限設定シートが見つかりません');
    }

    const data = permSheet.getDataRange().getValues();
    const headers = data[0];

    // 既存の役割をチェック
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] === roleName) {
        throw new Error('役割「' + roleName + '」は既に存在します');
      }
    }

    // 新しい行を追加（全ての権限をfalseに設定）
    const newRow = [roleName];
    for (let j = 1; j < headers.length; j++) {
      newRow.push(false);
    }

    const lastRow = permSheet.getLastRow();
    permSheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);

    Logger.log('✅ 新しい役割「' + roleName + '」を追加しました');

    return {
      success: true,
      message: '新しい役割「' + roleName + '」を追加しました'
    };

  } catch (error) {
    Logger.log('addNewRole ERROR: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 役割を削除
 * @param {string} roleName - 役割名
 * @returns {Object} 削除結果
 */
function deleteRole(roleName) {
  try {
    // システム役割は削除不可
    const systemRoles = ['オーナー', 'SE', 'リーダー', '営業', 'CS'];
    if (systemRoles.indexOf(roleName) !== -1) {
      throw new Error('システム役割「' + roleName + '」は削除できません');
    }

    const ss = getSpreadsheet();
    const permSheet = ss.getSheetByName(CONFIG.SHEETS.PERMISSIONS);

    if (!permSheet) {
      throw new Error('権限設定シートが見つかりません');
    }

    const data = permSheet.getDataRange().getValues();

    // 役割の行を検索
    let roleRowIndex = -1;
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] === roleName) {
        roleRowIndex = i;
        break;
      }
    }

    if (roleRowIndex === -1) {
      throw new Error('役割「' + roleName + '」が見つかりません');
    }

    // 行を削除
    permSheet.deleteRow(roleRowIndex + 1);

    Logger.log('✅ 役割「' + roleName + '」を削除しました');

    return {
      success: true,
      message: '役割「' + roleName + '」を削除しました'
    };

  } catch (error) {
    Logger.log('deleteRole ERROR: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
