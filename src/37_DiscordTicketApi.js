/** Phase 2-C 案α: CRMから管理者が手動で顧客専用Discordチャンネルを発行する。 */
function createDiscordTicketForCustomer(sessionId, customerId) {
  try {
    setEmailFromSession(sessionId);
    checkPermission('admin_access');
    var normalizedCustomerId = String(customerId || '').trim();
    if (!normalizedCustomerId) return { success: false, error: '顧客IDを指定してください。' };
    var scriptProps = PropertiesService.getScriptProperties();
    var guildId = scriptProps.getProperty('DISCORD_GUILD_ID');
    var categoryId = scriptProps.getProperty('DISCORD_CATEGORY_ID');
    var botToken = scriptProps.getProperty('DISCORD_BOT_TOKEN');
    if (!guildId || !categoryId) return { success: false, error: 'Discordチャンネルのセットアップが未完了です。先にセットアップを実行してください。' };
    if (!botToken) return { success: false, error: 'Botトークンが未設定です。Discord連携設定で登録してください。' };
    var table = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'CUSTOMERS');
    var customerIdHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_ID');
    var customerNameHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'CUSTOMER_NAME');
    var discordUserIdHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'DISCORD_USER_ID');
    var channelIdHeader = getCoreSchemaV1HeaderName('CUSTOMERS', 'DISCORD_CHANNEL_ID');
    var count = Math.max(0, table.sheet.getLastRow() - 1);
    if (!count) return { success: false, error: '顧客が見つかりません。' };
    var rows = table.sheet.getRange(2, 1, count, table.sheet.getLastColumn()).getValues();
    var index = rows.findIndex(function(row) { return String(row[table.headerIndexes[customerIdHeader] - 1] || '').trim() === normalizedCustomerId; });
    if (index === -1) return { success: false, error: '顧客が見つかりません。' };
    var row = rows[index];
    var existingChannelId = String(row[table.headerIndexes[channelIdHeader] - 1] || '').trim();
    var customerName = String(row[table.headerIndexes[customerNameHeader] - 1] || '').trim();
    var discordUserId = String(row[table.headerIndexes[discordUserIdHeader] - 1] || '').trim();
    if (existingChannelId) return { success: true, reused: true, channelId: existingChannelId, channelName: buildDiscordTicketChannelName_(customerName, discordUserId) };
    if (!customerName) return { success: false, error: '顧客名が未設定です。' };
    if (!/^\d{17,19}$/.test(discordUserId)) return { success: false, error: 'DiscordユーザーIDが未設定または不正です。' };
    var connectionResult = testDiscordConnection();
    if (!connectionResult.success || !connectionResult.botInfo || !connectionResult.botInfo.id) return { success: false, error: 'Discord Botに接続できませんでした。トークンを確認してください。' };
    var channelName = buildDiscordTicketChannelName_(customerName, discordUserId);
    var result = discordRequest_(botToken, 'post', '/guilds/' + guildId + '/channels', { name: channelName, type: 0, parent_id: categoryId });
    if (result.statusCode !== 200 && result.statusCode !== 201) { Logger.log('createDiscordTicketForCustomer: channel create error status=' + result.statusCode); return { success: false, error: 'チケットチャンネルの作成に失敗しました。(status: ' + result.statusCode + ')' }; }
    var channelId = String(result.data && result.data.id || '').trim();
    if (!channelId) return { success: false, error: 'チケットチャンネルIDを取得できませんでした。' };
    applyPermissionOverwrites_(botToken, channelId, guildId, connectionResult.botInfo.id);
    table.sheet.getRange(index + 2, table.headerIndexes[channelIdHeader]).setValue(channelId);
    Logger.log('createDiscordTicketForCustomer: created channelId=' + channelId);
    return { success: true, reused: false, channelId: channelId, channelName: channelName };
  } catch (error) { Logger.log('createDiscordTicketForCustomer error: ' + error.message); return { success: false, error: error.message || 'チケットチャンネルの作成に失敗しました。' }; }
}
function buildDiscordTicketChannelName_(customerName, discordUserId) {
  var name = String(customerName || '').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'customer';
  return 'ticket-' + name + '-' + String(discordUserId || '').slice(-4);
}
