/**
 * ShiftService.gs
 * シフト管理機能を提供するサービス
 * Phase 4: シフト管理
 */

// ==================== 時間帯定義 ====================
const SHIFT_TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
];

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

// ==================== シフト取得関数 ====================

/**
 * 自分のシフトを取得
 * @param {string} staffId - 担当者ID
 * @param {string} targetWeek - 対象週（YYYY/MM/DD形式、週の月曜日）
 * @returns {Object} シフトデータ
 */
function getMyShift(staffId, targetWeek) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SHIFT);

  if (!sheet || sheet.getLastRow() < 2) {
    return { shifts: [], targetWeek: targetWeek };
  }

  const data = getSheetDataAsObjects(sheet);

  // 担当者ID + 対象週でフィルタ
  const myShifts = data.filter(row =>
    row['担当者ID'] === staffId && row['対象週'] === targetWeek
  );

  return {
    shifts: myShifts,
    targetWeek: targetWeek
  };
}

/**
 * 週間シフト一覧を取得（管理者用）
 * @param {string} targetWeek - 対象週（YYYY/MM/DD形式、週の月曜日）
 * @returns {Object} 週間シフトデータ
 */
function getWeeklyShifts(targetWeek) {
  const ss = getSpreadsheet();
  const shiftSheet = ss.getSheetByName(CONFIG.SHEETS.SHIFT);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!shiftSheet || shiftSheet.getLastRow() < 2) {
    return { shifts: [], staffList: [], targetWeek: targetWeek };
  }

  const shiftData = getSheetDataAsObjects(shiftSheet);
  const staffData = staffSheet ? getSheetDataAsObjects(staffSheet) : [];

  // 有効なスタッフのみ
  const activeStaff = staffData.filter(s => s['ステータス'] === '有効');

  // 対象週のシフトをフィルタ
  const weekShifts = shiftData.filter(row => row['対象週'] === targetWeek);

  // スタッフごとに整理
  const shiftsByStaff = {};
  activeStaff.forEach(staff => {
    const staffId = staff['担当者ID'];
    const staffName = getStaffFullName(staff);

    shiftsByStaff[staffId] = {
      担当者ID: staffId,
      担当者名: staffName,
      役割: staff['役割'],
      shifts: {}
    };

    WEEKDAYS.forEach(day => {
      shiftsByStaff[staffId].shifts[day] = null;
    });
  });

  // シフトデータをマッピング
  weekShifts.forEach(shift => {
    const staffId = shift['担当者ID'];
    const day = shift['曜日'];

    if (shiftsByStaff[staffId] && day) {
      shiftsByStaff[staffId].shifts[day] = {
        時間帯1: shift['時間帯1_開始'] && shift['時間帯1_終了'] ?
          { 開始: shift['時間帯1_開始'], 終了: shift['時間帯1_終了'] } : null,
        時間帯2: shift['時間帯2_開始'] && shift['時間帯2_終了'] ?
          { 開始: shift['時間帯2_開始'], 終了: shift['時間帯2_終了'] } : null,
        時間帯3: shift['時間帯3_開始'] && shift['時間帯3_終了'] ?
          { 開始: shift['時間帯3_開始'], 終了: shift['時間帯3_終了'] } : null
      };
    }
  });

  return {
    shifts: Object.values(shiftsByStaff),
    staffList: activeStaff.map(s => ({
      担当者ID: s['担当者ID'],
      担当者名: getStaffFullName(s),
      役割: s['役割']
    })),
    targetWeek: targetWeek,
    weekdays: WEEKDAYS
  };
}

// ==================== シフト保存関数 ====================

/**
 * シフトを保存（1日分）
 * @param {string} staffId - 担当者ID
 * @param {string} targetWeek - 対象週
 * @param {string} day - 曜日
 * @param {Object} shiftData - シフトデータ
 * @returns {Object} 結果
 */
function saveShift(staffId, targetWeek, day, shiftData) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SHIFT);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!sheet) {
    throw new Error('シフトシートが見つかりません');
  }

  // 担当者名を取得
  let staffName = '';
  if (staffSheet) {
    const staffData = getSheetDataAsObjects(staffSheet);
    const staff = staffData.find(s => s['担当者ID'] === staffId);
    if (staff) {
      staffName = getStaffFullName(staff);
    }
  }

  // 時間帯のバリデーション
  const validatedData = validateShiftTimes(shiftData);

  // 既存のシフトを検索
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const staffIdIdx = headers.indexOf('担当者ID');
  const weekIdx = headers.indexOf('対象週');
  const dayIdx = headers.indexOf('曜日');

  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][staffIdIdx] === staffId &&
        data[i][weekIdx] === targetWeek &&
        data[i][dayIdx] === day) {
      existingRow = i + 1;
      break;
    }
  }

  const now = new Date();

  if (existingRow > 0) {
    // 既存行を更新
    const updateRange = sheet.getRange(existingRow, 1, 1, headers.length);
    const rowData = [
      data[existingRow - 1][headers.indexOf('シフトID')], // 既存ID維持
      staffId,
      staffName,
      targetWeek,
      day,
      validatedData.時間帯1?.開始 || '',
      validatedData.時間帯1?.終了 || '',
      validatedData.時間帯2?.開始 || '',
      validatedData.時間帯2?.終了 || '',
      validatedData.時間帯3?.開始 || '',
      validatedData.時間帯3?.終了 || '',
      data[existingRow - 1][headers.indexOf('提出日時')], // 既存維持
      now // 更新日時
    ];
    updateRange.setValues([rowData]);
  } else {
    // 新規行を追加
    const shiftId = generateShiftId(sheet);
    const newRow = [
      shiftId,
      staffId,
      staffName,
      targetWeek,
      day,
      validatedData.時間帯1?.開始 || '',
      validatedData.時間帯1?.終了 || '',
      validatedData.時間帯2?.開始 || '',
      validatedData.時間帯2?.終了 || '',
      validatedData.時間帯3?.開始 || '',
      validatedData.時間帯3?.終了 || '',
      now, // 提出日時
      now  // 更新日時
    ];
    sheet.appendRow(newRow);
  }

  return { success: true, staffId: staffId, day: day };
}

/**
 * 週間シフトを一括保存
 * @param {string} staffId - 担当者ID
 * @param {string} targetWeek - 対象週
 * @param {Object} weeklyShifts - 曜日ごとのシフトデータ
 * @returns {Object} 結果
 */
function saveWeeklyShift(staffId, targetWeek, weeklyShifts) {
  const results = [];

  WEEKDAYS.forEach(day => {
    if (weeklyShifts[day]) {
      try {
        const result = saveShift(staffId, targetWeek, day, weeklyShifts[day]);
        results.push({ day: day, success: true });
      } catch (error) {
        results.push({ day: day, success: false, error: error.message });
      }
    }
  });

  const successCount = results.filter(r => r.success).length;

  return {
    success: successCount > 0,
    savedCount: successCount,
    totalCount: results.length,
    results: results
  };
}

// ==================== ヘルパー関数 ====================

/**
 * シフトIDを生成
 * @param {Sheet} sheet - シフトシート
 * @returns {string} シフトID
 */
function generateShiftId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 'SH-00001';
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let maxNum = 0;

  data.forEach(row => {
    const id = row[0];
    if (id && typeof id === 'string' && id.startsWith('SH-')) {
      const num = parseInt(id.replace('SH-', ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return 'SH-' + String(maxNum + 1).padStart(5, '0');
}

/**
 * シフト時間のバリデーション
 * @param {Object} shiftData - シフトデータ
 * @returns {Object} バリデーション済みデータ
 */
function validateShiftTimes(shiftData) {
  const validated = {};

  ['時間帯1', '時間帯2', '時間帯3'].forEach(slot => {
    if (shiftData[slot] && shiftData[slot].開始 && shiftData[slot].終了) {
      const start = shiftData[slot].開始;
      const end = shiftData[slot].終了;

      // 時間形式チェック
      if (SHIFT_TIME_SLOTS.includes(start) && SHIFT_TIME_SLOTS.includes(end)) {
        // 開始 < 終了 チェック
        if (start < end) {
          validated[slot] = { 開始: start, 終了: end };
        }
      }
    }
  });

  return validated;
}

/**
 * 今週の月曜日を取得
 * @returns {string} YYYY/MM/DD形式
 */
function getCurrentWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));

  return formatDate(monday);
}

/**
 * 日付をフォーマット
 * @param {Date} date - 日付
 * @returns {string} YYYY/MM/DD形式
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 次週の月曜日を取得
 * @param {string} currentWeek - 現在の週（YYYY/MM/DD形式）
 * @returns {string} YYYY/MM/DD形式
 */
function getNextWeekMonday(currentWeek) {
  const [year, month, day] = currentWeek.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 7);
  return formatDate(date);
}

/**
 * 前週の月曜日を取得
 * @param {string} currentWeek - 現在の週（YYYY/MM/DD形式）
 * @returns {string} YYYY/MM/DD形式
 */
function getPrevWeekMonday(currentWeek) {
  const [year, month, day] = currentWeek.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 7);
  return formatDate(date);
}

/**
 * シフト提出状況を取得
 * @param {string} targetWeek - 対象週
 * @returns {Object} 提出状況
 */
function getShiftSubmissionStatus(targetWeek) {
  const ss = getSpreadsheet();
  const shiftSheet = ss.getSheetByName(CONFIG.SHEETS.SHIFT);
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);

  if (!staffSheet) {
    return { error: 'スタッフシートが見つかりません' };
  }

  const staffData = getSheetDataAsObjects(staffSheet);
  const shiftData = shiftSheet ? getSheetDataAsObjects(shiftSheet) : [];

  // 有効なスタッフのみ
  const activeStaff = staffData.filter(s => s['ステータス'] === '有効');

  // 対象週のシフト提出者を集計
  const submittedStaffIds = new Set();
  shiftData
    .filter(s => s['対象週'] === targetWeek)
    .forEach(s => submittedStaffIds.add(s['担当者ID']));

  const submitted = [];
  const notSubmitted = [];

  activeStaff.forEach(staff => {
    const staffInfo = {
      担当者ID: staff['担当者ID'],
      担当者名: getStaffFullName(staff),
      役割: staff['役割']
    };

    if (submittedStaffIds.has(staff['担当者ID'])) {
      submitted.push(staffInfo);
    } else {
      notSubmitted.push(staffInfo);
    }
  });

  return {
    targetWeek: targetWeek,
    submitted: submitted,
    notSubmitted: notSubmitted,
    submittedCount: submitted.length,
    totalCount: activeStaff.length,
    submissionRate: activeStaff.length > 0 ?
      Math.round((submitted.length / activeStaff.length) * 100) : 0
  };
}

/**
 * 時間帯選択肢を取得
 * @returns {Array} 時間帯リスト
 */
function getShiftTimeSlots() {
  return SHIFT_TIME_SLOTS;
}

/**
 * 曜日リストを取得
 * @returns {Array} 曜日リスト
 */
function getWeekdays() {
  return WEEKDAYS;
}
