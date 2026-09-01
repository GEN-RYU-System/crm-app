
// ============================================================
// ユーザー認証・権限取得
// ============================================================

/**
 * 現在のユーザー情報と権限を取得
 * @param {string} email - ユーザーのメールアドレス
 * @returns {Object} ユーザー情報と権限
 */
function getCurrentUserPermissions(email) {
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet || staffSheet.getLastRow() < 2) {
    return {
      success: false,
      error: 'ユーザー情報が見つかりません',
      isAuthenticated: false
    };
  }

  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];

  const emailIdx = headers.indexOf('email');
  const staffIdIdx = headers.indexOf('staff_id');
  const lastNameJpIdx = headers.indexOf('last_name_ja');
  const firstNameJpIdx = headers.indexOf('first_name_ja');
  const roleIdx = headers.indexOf('staff_role');
  const statusIdx = headers.indexOf('status');
  const teamIdIdx = headers.indexOf('チームID');

  // メールアドレスでユーザーを検索
  let user = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailIdx] === email) {
      user = {
        staffId: data[i][staffIdIdx],
        name: (data[i][lastNameJpIdx] || '') + ' ' + (data[i][firstNameJpIdx] || ''),
        email: data[i][emailIdx],
        role: data[i][roleIdx],
        status: data[i][statusIdx],
        teamId: data[i][teamIdIdx] || null
      };
      break;
    }
  }

  if (!user) {
    return {
      success: false,
      error: '登録されていないユーザーです',
      isAuthenticated: false
    };
  }

  if (user.status !== '有効') {
    return {
      success: false,
      error: 'アカウントが無効化されています',
      isAuthenticated: false,
      user: { staffId: user.staffId, name: user.name }
    };
  }

  // 役割から権限を取得
  const permissions = getRolePermissions(user.role);

  return {
    success: true,
    isAuthenticated: true,
    user: user,
    permissions: permissions,
    availableDashboards: getAvailableDashboards(permissions)
  };
}

/**
 * 担当者IDから権限情報を取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} 権限情報
 */
function getPermissionsByStaffId(staffId) {
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet || staffSheet.getLastRow() < 2) {
    return { success: false, error: '担当者マスタが見つかりません' };
  }

  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('staff_id');
  const roleIdx = headers.indexOf('staff_role');
  const statusIdx = headers.indexOf('status');
  const teamIdIdx = headers.indexOf('チームID');
  const lastNameJpIdx = headers.indexOf('last_name_ja');
  const firstNameJpIdx = headers.indexOf('first_name_ja');

  for (let i = 1; i < data.length; i++) {
    if (data[i][staffIdIdx] === staffId) {
      const role = data[i][roleIdx];
      const status = data[i][statusIdx];
      const teamId = data[i][teamIdIdx];
      const name = (data[i][lastNameJpIdx] || '') + ' ' + (data[i][firstNameJpIdx] || '');

      if (status !== '有効') {
        return { success: false, error: 'アカウントが無効化されています' };
      }

      const permissions = getRolePermissions(role);

      return {
        success: true,
        staffId: staffId,
        name: name,
        role: role,
        teamId: teamId,
        permissions: permissions,
        availableDashboards: getAvailableDashboards(permissions)
      };
    }
  }

  return { success: false, error: '担当者が見つかりません: ' + staffId };
}

/**
 * 役割から権限マップを取得
 * @param {string} role - 役割名
 * @returns {Object} 権限マップ
 */
function getRolePermissions(role) {
  // DEFAULT_ROLESから取得、なければ最小権限
  if (DEFAULT_ROLES[role]) {
    return DEFAULT_ROLES[role];
  }

  // 未定義の役割は最小権限（閲覧のみ）
  return {
    dashboard_personal: true,
    dashboard_team: false,
    dashboard_management: false,
    dashboard_cs: false,
    lead_view_all: false,
    lead_view_team: false,
    lead_view_own: true,
    lead_add: false,
    lead_edit: false,
    lead_delete: false,
    lead_assign: false,
    deal_view_all: false,
    deal_view_team: false,
    deal_view_own: true,
    deal_edit: false,
    team_stats: false,
    staff_manage: false,
    settings: false,
    admin_access: false,
    force_reset: false
  };
}

/**
 * 利用可能なダッシュボードタブを取得
 * @param {Object} permissions - 権限マップ
 * @returns {Array} 利用可能なダッシュボード名
 */
function getAvailableDashboards(permissions) {
  const dashboards = [];

  if (permissions.dashboard_personal) {
    dashboards.push('personal');
  }
  if (permissions.dashboard_team) {
    dashboards.push('team');
  }
  if (permissions.dashboard_management) {
    dashboards.push('management');
  }
  if (permissions.dashboard_cs) {
    dashboards.push('cs');
  }

  return dashboards;
}

// ============================================================
// 権限チェック
// ============================================================

/**
 * 特定の権限をチェック
 * @param {string} staffId - 担当者ID
 * @param {string} permissionKey - 権限キー
 * @returns {boolean} 権限があるかどうか
 */
function checkStaffPermission(staffId, permissionKey) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return false;
  }

  return permInfo.permissions[permissionKey] === true;
}

/**
 * 複数の権限をチェック（AND条件）
 * @param {string} staffId - 担当者ID
 * @param {Array} permissionKeys - 権限キーの配列
 * @returns {boolean} すべての権限があるかどうか
 */
function checkPermissionsAll(staffId, permissionKeys) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return false;
  }

  return permissionKeys.every(key => permInfo.permissions[key] === true);
}

/**
 * 複数の権限をチェック（OR条件）
 * @param {string} staffId - 担当者ID
 * @param {Array} permissionKeys - 権限キーの配列
 * @returns {boolean} いずれかの権限があるかどうか
 */
function checkPermissionsAny(staffId, permissionKeys) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return false;
  }

  return permissionKeys.some(key => permInfo.permissions[key] === true);
}

// ============================================================
// データフィルタリング
// ============================================================

/**
 * 閲覧可能なリードを取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} フィルタ済みリードデータ
 */
function getViewableLeads(staffId) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return { success: false, error: permInfo.error, leads: [] };
  }

  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet || leadSheet.getLastRow() < 2) {
    return { success: true, leads: [], total: 0 };
  }

  const data = leadSheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('assignee_id');

  let filteredLeads = [];

  // 権限に基づいてフィルタリング
  if (permInfo.permissions.lead_view_all) {
    // 全リード閲覧可能
    filteredLeads = data.slice(1);
  } else if (permInfo.permissions.lead_view_team && permInfo.teamId) {
    // チームのリードのみ
    const teamMembers = getTeamMemberIds(permInfo.teamId);
    filteredLeads = data.slice(1).filter(row =>
      teamMembers.includes(row[staffIdIdx])
    );
  } else if (permInfo.permissions.lead_view_own) {
    // 自分のリードのみ
    filteredLeads = data.slice(1).filter(row =>
      row[staffIdIdx] === staffId
    );
  }

  // オブジェクト形式に変換
  const leads = filteredLeads.map(row => {
    const lead = {};
    headers.forEach((header, idx) => {
      lead[header] = row[idx];
    });
    return lead;
  });

  return {
    success: true,
    leads: leads,
    total: leads.length,
    scope: permInfo.permissions.lead_view_all ? 'all' :
           (permInfo.permissions.lead_view_team ? 'team' : 'own')
  };
}

/**
 * 閲覧可能な商談を取得
 * @param {string} staffId - 担当者ID
 * @returns {Object} フィルタ済み商談データ
 */
function getViewableDeals(staffId) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return { success: false, error: permInfo.error, deals: [] };
  }

  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet || leadSheet.getLastRow() < 2) {
    return { success: true, deals: [], total: 0 };
  }

  const data = leadSheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('assignee_id');
  const statusIdx = headers.indexOf('進捗ステータス');

  // 商談ステータスのみ抽出
  const dealStatuses = CONFIG.DEAL_STATUSES;
  const dealRows = data.slice(1).filter(row =>
    dealStatuses.includes(row[statusIdx])
  );

  let filteredDeals = [];

  // 権限に基づいてフィルタリング
  if (permInfo.permissions.deal_view_all) {
    filteredDeals = dealRows;
  } else if (permInfo.permissions.deal_view_team && permInfo.teamId) {
    const teamMembers = getTeamMemberIds(permInfo.teamId);
    filteredDeals = dealRows.filter(row =>
      teamMembers.includes(row[staffIdIdx])
    );
  } else if (permInfo.permissions.deal_view_own) {
    filteredDeals = dealRows.filter(row =>
      row[staffIdIdx] === staffId
    );
  }

  // オブジェクト形式に変換
  const deals = filteredDeals.map(row => {
    const deal = {};
    headers.forEach((header, idx) => {
      deal[header] = row[idx];
    });
    return deal;
  });

  return {
    success: true,
    deals: deals,
    total: deals.length,
    scope: permInfo.permissions.deal_view_all ? 'all' :
           (permInfo.permissions.deal_view_team ? 'team' : 'own')
  };
}

/**
 * チームメンバーのIDリストを取得
 * @param {string} teamId - チームID
 * @returns {Array} メンバーIDのリスト
 */
function getTeamMemberIds(teamId) {
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet || staffSheet.getLastRow() < 2) {
    return [];
  }

  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = _webAppStaffHeaderIdx(headers, 'staff_id', '担当者ID');
  const teamIdIdx = headers.indexOf('チームID');
  const statusIdx = headers.indexOf('ステータス');

  const memberIds = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][teamIdIdx] === teamId && data[i][statusIdx] === '有効') {
      memberIds.push(data[i][staffIdIdx]);
    }
  }

  return memberIds;
}

// ============================================================
// リソース別アクセス権チェック
// ============================================================

/**
 * 特定リードの編集権限をチェック
 * @param {string} staffId - 担当者ID
 * @param {string} leadId - リードID
 * @returns {Object} アクセス権情報
 */
function canEditLead(staffId, leadId) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return { canEdit: false, reason: permInfo.error };
  }

  // 編集権限がない場合
  if (!permInfo.permissions.lead_edit) {
    return { canEdit: false, reason: 'リード編集権限がありません' };
  }

  // 全リード編集可能な場合
  if (permInfo.permissions.lead_view_all) {
    return { canEdit: true, scope: 'all' };
  }

  // リードの担当者を確認
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet) {
    return { canEdit: false, reason: 'リードシートが見つかりません' };
  }

  const data = leadSheet.getDataRange().getValues();
  const headers = data[0];

  const leadIdIdx = headers.indexOf('lead_id');
  const leadStaffIdIdx = headers.indexOf('assignee_id');

  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      const leadOwner = data[i][leadStaffIdIdx];

      // 自分のリードの場合
      if (leadOwner === staffId) {
        return { canEdit: true, scope: 'own' };
      }

      // チームメンバーのリードの場合
      if (permInfo.permissions.lead_view_team && permInfo.teamId) {
        const teamMembers = getTeamMemberIds(permInfo.teamId);
        if (teamMembers.includes(leadOwner)) {
          return { canEdit: true, scope: 'team' };
        }
      }

      return { canEdit: false, reason: 'このリードの編集権限がありません' };
    }
  }

  return { canEdit: false, reason: 'リードが見つかりません: ' + leadId };
}

/**
 * 特定商談の編集権限をチェック
 * @param {string} staffId - 担当者ID
 * @param {string} leadId - リードID（商談はリードIDで管理）
 * @returns {Object} アクセス権情報
 */
function canEditDeal(staffId, leadId) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return { canEdit: false, reason: permInfo.error };
  }

  // 商談編集権限がない場合
  if (!permInfo.permissions.deal_edit) {
    return { canEdit: false, reason: '商談編集権限がありません' };
  }

  // 全商談編集可能な場合
  if (permInfo.permissions.deal_view_all) {
    return { canEdit: true, scope: 'all' };
  }

  // 商談の担当者を確認
  const ss = getSpreadsheet();
  const leadSheet = ss.getSheetByName(CONFIG.SHEETS.LEADS);

  if (!leadSheet) {
    return { canEdit: false, reason: 'リードシートが見つかりません' };
  }

  const data = leadSheet.getDataRange().getValues();
  const headers = data[0];

  const leadIdIdx = headers.indexOf('lead_id');
  const leadStaffIdIdx = headers.indexOf('assignee_id');
  const statusIdx = headers.indexOf('進捗ステータス');

  for (let i = 1; i < data.length; i++) {
    if (data[i][leadIdIdx] === leadId) {
      const dealOwner = data[i][leadStaffIdIdx];
      const status = data[i][statusIdx];

      // 商談ステータスでない場合
      if (!CONFIG.DEAL_STATUSES.includes(status)) {
        return { canEdit: false, reason: 'このリードは商談ステータスではありません' };
      }

      // 自分の商談の場合
      if (dealOwner === staffId) {
        return { canEdit: true, scope: 'own' };
      }

      // チームメンバーの商談の場合
      if (permInfo.permissions.deal_view_team && permInfo.teamId) {
        const teamMembers = getTeamMemberIds(permInfo.teamId);
        if (teamMembers.includes(dealOwner)) {
          return { canEdit: true, scope: 'team' };
        }
      }

      return { canEdit: false, reason: 'この商談の編集権限がありません' };
    }
  }

  return { canEdit: false, reason: '商談が見つかりません: ' + leadId };
}

/**
 * アサイン権限をチェック
 * @param {string} staffId - 担当者ID
 * @returns {Object} アサイン権限情報
 */
function canAssignLead(staffId) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return { canAssign: false, reason: permInfo.error };
  }

  if (!permInfo.permissions.lead_assign) {
    return { canAssign: false, reason: 'リードアサイン権限がありません' };
  }

  // アサイン可能な担当者リストを取得
  let assignableStaff = [];

  if (permInfo.permissions.lead_view_all) {
    // 全担当者にアサイン可能
    assignableStaff = getAllActiveStaff();
  } else if (permInfo.teamId) {
    // チームメンバーにのみアサイン可能
    assignableStaff = getTeamMembers(permInfo.teamId);
  }

  return {
    canAssign: true,
    assignableStaff: assignableStaff,
    scope: permInfo.permissions.lead_view_all ? 'all' : 'team'
  };
}

/**
 * 全有効担当者を取得
 * @returns {Array} 担当者リスト
 */
function getAllActiveStaff() {
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet || staffSheet.getLastRow() < 2) {
    return [];
  }

  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('staff_id');
  const lastNameIdx = headers.indexOf('last_name_ja');
  const firstNameIdx = headers.indexOf('first_name_ja');
  const roleIdx = headers.indexOf('staff_role');
  const statusIdx = headers.indexOf('status');
  const teamIdIdx = headers.indexOf('チームID');

  const staff = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][statusIdx] === '有効') {
      staff.push({
        staffId: data[i][staffIdIdx],
        name: (data[i][lastNameIdx] || '') + ' ' + (data[i][firstNameIdx] || ''),
        role: data[i][roleIdx],
        teamId: data[i][teamIdIdx]
      });
    }
  }

  return staff;
}

/**
 * チームメンバーを取得
 * @param {string} teamId - チームID
 * @returns {Array} メンバーリスト
 */
function getTeamMembers(teamId) {
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet || staffSheet.getLastRow() < 2) {
    return [];
  }

  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];

  const staffIdIdx = headers.indexOf('staff_id');
  const lastNameIdx = headers.indexOf('last_name_ja');
  const firstNameIdx = headers.indexOf('first_name_ja');
  const roleIdx = headers.indexOf('staff_role');
  const statusIdx = headers.indexOf('status');
  const teamIdIdx = headers.indexOf('チームID');

  const members = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][teamIdIdx] === teamId && data[i][statusIdx] === '有効') {
      members.push({
        staffId: data[i][staffIdIdx],
        name: (data[i][lastNameIdx] || '') + ' ' + (data[i][firstNameIdx] || ''),
        role: data[i][roleIdx],
        teamId: data[i][teamIdIdx]
      });
    }
  }

  return members;
}

// ============================================================
// API用ラッパー関数
// ============================================================

/**
 * 権限チェックAPI用
 * @param {Object} params - {staffId, action, resourceId}
 * @returns {Object} 権限チェック結果
 */
function checkAccessApi(params) {
  const { staffId, action, resourceId } = params;

  switch (action) {
    case 'editLead':
      return canEditLead(staffId, resourceId);

    case 'editDeal':
      return canEditDeal(staffId, resourceId);

    case 'assignLead':
      return canAssignLead(staffId);

    case 'viewLeads':
      return {
        canView: checkPermissionsAny(staffId, ['lead_view_all', 'lead_view_team', 'lead_view_own']),
        scope: getViewScope(staffId, 'lead')
      };

    case 'viewDeals':
      return {
        canView: checkPermissionsAny(staffId, ['deal_view_all', 'deal_view_team', 'deal_view_own']),
        scope: getViewScope(staffId, 'deal')
      };

    default:
      return { error: '不明なアクション: ' + action };
  }
}

/**
 * ビュースコープを取得
 * @param {string} staffId - 担当者ID
 * @param {string} type - 'lead' または 'deal'
 * @returns {string} スコープ ('all', 'team', 'own')
 */
function getViewScope(staffId, type) {
  const permInfo = getPermissionsByStaffId(staffId);

  if (!permInfo.success) {
    return 'none';
  }

  const prefix = type === 'lead' ? 'lead_view' : 'deal_view';

  if (permInfo.permissions[prefix + '_all']) {
    return 'all';
  }
  if (permInfo.permissions[prefix + '_team']) {
    return 'team';
  }
  if (permInfo.permissions[prefix + '_own']) {
    return 'own';
  }

  return 'none';
}
