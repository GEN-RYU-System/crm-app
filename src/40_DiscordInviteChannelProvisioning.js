function applyDiscordMemberPermissions_(botToken, channelId, memberIds) {
  var allow = String(1024 + 2048 + 65536);
  (memberIds || []).filter(function(id) { return /^\d{17,19}$/.test(String(id || '')); }).forEach(function(id) {
    discordRequest_(botToken, 'put', '/channels/' + channelId + '/permissions/' + id, { type: 1, allow: allow, deny: '0' });
  });
}
function getDiscordOwnerIds_() {
  var table = validateCoreSchemaV1TableForWrite(getSpreadsheet(), 'STAFF');
  var role = getCoreSchemaV1HeaderName('STAFF', 'ROLE'), discord = getCoreSchemaV1HeaderName('STAFF', 'DISCORD_ID');
  var rows = table.sheet.getDataRange().getValues();
  return rows.slice(1).filter(function(r){return String(r[table.headerIndexes[role]-1])==='オーナー';}).map(function(r){return String(r[table.headerIndexes[discord]-1]||'');}).filter(function(id){return /^\d{17,19}$/.test(id);});
}

/**
 * 顧客規模（sheet値）からDiscordロールIDを返す。
 * 規模が未設定・不明の場合は null を返し警告をログに記録する。
 * @param {string} scaleLabelValue - シート上の表示値（例: '小口' | '大口'）
 * @param {GoogleAppsScript.Properties.Properties} scriptProps
 * @returns {string|null}
 */
function resolveDiscordRoleId_(scaleLabelValue, scriptProps) {
  var values = CORE_SCHEMA_V1_TABLES.CUSTOMERS.values.CUSTOMER_SCALE;
  var scaleKey = null;
  Object.keys(values).forEach(function(k) { if (values[k] === String(scaleLabelValue || '').trim()) scaleKey = k; });
  if (!scaleKey) {
    Logger.log('resolveDiscordRoleId_: 顧客規模が未設定または不明のためロール付与をスキップします (value="' + scaleLabelValue + '")');
    return null;
  }
  var roleId = scaleKey === 'LARGE'
    ? scriptProps.getProperty('DISCORD_PARTNER_ROLE_ID')
    : scriptProps.getProperty('DISCORD_CUSTOMER_ROLE_ID');
  if (!roleId) {
    Logger.log('resolveDiscordRoleId_: ロールIDが未設定です (scaleKey=' + scaleKey + ')。先にセットアップを実行してください。');
    return null;
  }
  return roleId;
}

/**
 * 顧客規模（sheet値）から使用するカテゴリIDを返す。
 * 大口 → Partner カテゴリ、小口 → Customer カテゴリ。
 * 未設定の場合は GEN-RYU CRM カテゴリ（フォールバック）。
 * @param {string} scaleLabelValue
 * @param {GoogleAppsScript.Properties.Properties} scriptProps
 * @returns {string}
 */
function resolveDiscordCategoryId_(scaleLabelValue, scriptProps) {
  var values = CORE_SCHEMA_V1_TABLES.CUSTOMERS.values.CUSTOMER_SCALE;
  var scaleKey = null;
  Object.keys(values).forEach(function(k) { if (values[k] === String(scaleLabelValue || '').trim()) scaleKey = k; });
  if (scaleKey === 'LARGE') return scriptProps.getProperty('DISCORD_PARTNER_CATEGORY_ID') || scriptProps.getProperty('DISCORD_CATEGORY_ID') || '';
  if (scaleKey === 'SMALL') return scriptProps.getProperty('DISCORD_CUSTOMER_CATEGORY_ID') || scriptProps.getProperty('DISCORD_CATEGORY_ID') || '';
  return scriptProps.getProperty('DISCORD_CATEGORY_ID') || '';
}

function provisionDiscordInviteChannels() {
  var props=PropertiesService.getScriptProperties(), records=getDiscordCustomerInviteRecords_(), token=props.getProperty('DISCORD_BOT_TOKEN'), guild=props.getProperty('DISCORD_GUILD_ID');
  var ready=records.filter(function(r){return r.status==='ready';}); if(ready.length!==1)return {success:true,provisioned:0};
  var r=ready[0], customer=getDiscordCustomerRow_(r.customerId), ids=getDiscordOwnerIds_();
  var channelHeader=getCoreSchemaV1HeaderName('CUSTOMERS','DISCORD_CHANNEL_ID'), nameHeader=getCoreSchemaV1HeaderName('CUSTOMERS','CUSTOMER_NAME'), userHeader=getCoreSchemaV1HeaderName('CUSTOMERS','DISCORD_USER_ID'), scaleHeader=getCoreSchemaV1HeaderName('CUSTOMERS','CUSTOMER_SCALE');
  if(String(customer.row[customer.table.headerIndexes[channelHeader]-1]||'')) {r.status='provisioned';saveDiscordCustomerInviteRecords_(records);return {success:true,provisioned:0};}
  var scaleLabelValue = String(customer.row[customer.table.headerIndexes[scaleHeader]-1]||'');
  var category = resolveDiscordCategoryId_(scaleLabelValue, props);
  var result=discordRequest_(token,'post','/guilds/'+guild+'/channels',{name:buildDiscordTicketChannelName_(String(customer.row[customer.table.headerIndexes[nameHeader]-1]||''),r.memberId),type:0,parent_id:category});
  if(result.statusCode!==200&&result.statusCode!==201)return {success:false,error:'チャンネル作成に失敗しました。'};
  var id=String(result.data.id); applyPermissionOverwrites_(token,id,guild,testDiscordConnection().botInfo.id); applyDiscordMemberPermissions_(token,id,[r.memberId].concat(ids));
  customer.table.sheet.getRange(customer.rowIndex+2,customer.table.headerIndexes[channelHeader]).setValue(id);
  // ロール付与（顧客規模に応じて）
  var roleId = resolveDiscordRoleId_(scaleLabelValue, props);
  if (roleId && /^\d{17,19}$/.test(String(r.memberId||''))) {
    var roleResult = discordRequest_(token, 'put', '/guilds/'+guild+'/members/'+r.memberId+'/roles/'+roleId, null);
    if (roleResult.statusCode !== 204) {
      Logger.log('provisionDiscordInviteChannels: ロール付与エラー status=' + roleResult.statusCode + discordErrorDetail_(roleResult.data));
    } else {
      Logger.log('provisionDiscordInviteChannels: ロール付与完了 roleId=' + roleId);
    }
  }
  r.status='provisioned';saveDiscordCustomerInviteRecords_(records);
  if(!ids.length)Logger.log('Discord owner ID is not configured');
  return {success:true,provisioned:1};
}
