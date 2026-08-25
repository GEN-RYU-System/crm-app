/** 顧客ごとの1回限りDiscord招待URLを発行するAPI。 */
var DISCORD_CUSTOMER_INVITES_PROPERTY = 'DISCORD_CUSTOMER_INVITES';

function getDiscordCustomerInviteRecords_() {
  var raw = PropertiesService.getScriptProperties().getProperty(DISCORD_CUSTOMER_INVITES_PROPERTY);
  if (!raw) return [];
  try { var records = JSON.parse(raw); return Array.isArray(records) ? records : []; } catch (error) { return []; }
}

function saveDiscordCustomerInviteRecords_(records) {
  PropertiesService.getScriptProperties().setProperty(DISCORD_CUSTOMER_INVITES_PROPERTY, JSON.stringify(records));
}

function getDiscordCustomerRow_(customerId) {
  var table = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'CUSTOMERS');
  var idHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_ID');
  var count = Math.max(0, table.sheet.getLastRow() - 1);
  if (!count) return null;
  var rows = table.sheet.getRange(2, 1, count, table.sheet.getLastColumn()).getValues();
  var index = rows.findIndex(function(row) { return String(row[table.headerIndexes[idHeader] - 1] || '').trim() === customerId; });
  return index === -1 ? null : { table: table, rowIndex: index, row: rows[index] };
}

/**
 * 顧客専用の未使用招待を冪等に発行する。
 * @param {string} sessionId
 * @param {string} customerId
 * @returns {{success:boolean,reused?:boolean,url?:string,error?:string}}
 */
function createDiscordInviteForCustomer(sessionId, customerId) {
  setEmailFromSession(sessionId);
  try {
    checkPermission('admin_access');
    var normalizedCustomerId = String(customerId || '').trim();
    if (!normalizedCustomerId) return { success: false, error: '顧客IDを指定してください。' };
    if (!getDiscordCustomerRow_(normalizedCustomerId)) return { success: false, error: '顧客が見つかりません。' };
    var records = getDiscordCustomerInviteRecords_();
    var existing = records.find(function(record) { return record.customerId === normalizedCustomerId && record.status === 'issued'; });
    if (existing) return { success: true, reused: true, url: existing.url };

    var props = PropertiesService.getScriptProperties();
    var channelId = props.getProperty('DISCORD_TICKET_CHANNEL_ID');
    var botToken = props.getProperty('DISCORD_BOT_TOKEN');
    if (!channelId || !botToken) return { success: false, error: 'DiscordチャンネルセットアップとBotトークンの設定が必要です。' };
    var response = discordRequest_(botToken, 'post', '/channels/' + channelId + '/invites', {
      max_uses: 1, max_age: 0, unique: true
    });
    if (response.statusCode !== 200 && response.statusCode !== 201) {
      return { success: false, error: response.statusCode === 403 ? '招待URLを発行するBot権限が不足しています。Botを再招待してください。' : '招待URLの発行に失敗しました。' };
    }
    var code = String(response.data && response.data.code || '').trim();
    if (!code) return { success: false, error: '招待コードを取得できませんでした。' };
    var url = 'https://discord.gg/' + code;
    records.push({ customerId: normalizedCustomerId, code: code, url: url, issuedAt: new Date().toISOString(), status: 'issued' });
    saveDiscordCustomerInviteRecords_(records);
    return { success: true, reused: false, url: url };
  } catch (error) {
    Logger.log('createDiscordInviteForCustomer error: ' + error.message);
    return { success: false, error: error.message || '招待URLの発行に失敗しました。' };
  }
}
