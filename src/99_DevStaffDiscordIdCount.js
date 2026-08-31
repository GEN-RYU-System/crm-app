/**
 * DEV: 担当者マスタの 'Discord ID' 列に実値が入っている件数を返す（読み取り専用）
 * 値そのものは返さない。件数と担当者ID（LDO形式）の検証のみを行う。
 */
function devCountStaffDiscordIds() {
  if (getEnvironment() !== 'development') {
    throw new Error('devCountStaffDiscordIds is available only in development');
  }
  const ss = getSpreadsheet();
  const staffSheet = ss.getSheetByName(CONFIG.SHEETS.STAFF);
  if (!staffSheet || staffSheet.getLastRow() < 2) {
    return { discordIdFilledCount: 0, totalStaffRows: 0, headerFound: false };
  }
  const data = staffSheet.getDataRange().getValues();
  const headers = data[0];
  const discordCol = (function(h){ var i=h.indexOf('discord_id'); return i!==-1?i:h.indexOf('Discord ID'); })(headers);
  const staffIdCol = (function(h){ var i=h.indexOf('staff_id'); return i!==-1?i:h.indexOf('担当者ID'); })(headers);

  let discordIdFilledCount = 0;
  let ldoFormatCount = 0;
  let nonLdoFormatCount = 0;
  let emptyStaffIdCount = 0;
  const ldoPattern = /^LDO-\d{4}$/;

  for (let i = 1; i < data.length; i++) {
    if (discordCol !== -1) {
      const discordValue = data[i][discordCol];
      if (discordValue !== '' && discordValue !== null && discordValue !== undefined) {
        discordIdFilledCount += 1;
      }
    }
    if (staffIdCol !== -1) {
      const staffId = String(data[i][staffIdCol] || '').trim();
      if (!staffId) {
        emptyStaffIdCount += 1;
      } else if (ldoPattern.test(staffId)) {
        ldoFormatCount += 1;
      } else {
        nonLdoFormatCount += 1;
      }
    }
  }

  return {
    discordIdHeaderFound: discordCol !== -1,
    discordIdFilledCount: discordIdFilledCount,
    staffIdHeaderFound: staffIdCol !== -1,
    staffIdLdoFormatCount: ldoFormatCount,
    staffIdNonLdoFormatCount: nonLdoFormatCount,
    staffIdEmptyCount: emptyStaffIdCount,
    totalStaffRows: data.length - 1,
    autoFillWillWriteLdoOnly: staffIdCol !== -1 && nonLdoFormatCount === 0
  };
}
