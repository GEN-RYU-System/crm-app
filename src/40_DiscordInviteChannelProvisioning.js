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
function provisionDiscordInviteChannels() {
  var props=PropertiesService.getScriptProperties(), records=getDiscordCustomerInviteRecords_(), token=props.getProperty('DISCORD_BOT_TOKEN'), guild=props.getProperty('DISCORD_GUILD_ID'), category=props.getProperty('DISCORD_CATEGORY_ID');
  var ready=records.filter(function(r){return r.status==='ready';}); if(ready.length!==1)return {success:true,provisioned:0};
  var r=ready[0], customer=getDiscordCustomerRow_(r.customerId), ids=getDiscordOwnerIds_();
  var channelHeader=getCoreSchemaV1HeaderName('CUSTOMERS','DISCORD_CHANNEL_ID'), nameHeader=getCoreSchemaV1HeaderName('CUSTOMERS','CUSTOMER_NAME'), userHeader=getCoreSchemaV1HeaderName('CUSTOMERS','DISCORD_USER_ID');
  if(String(customer.row[customer.table.headerIndexes[channelHeader]-1]||'')) {r.status='provisioned';saveDiscordCustomerInviteRecords_(records);return {success:true,provisioned:0};}
  var result=discordRequest_(token,'post','/guilds/'+guild+'/channels',{name:buildDiscordTicketChannelName_(String(customer.row[customer.table.headerIndexes[nameHeader]-1]||''),r.memberId),type:0,parent_id:category});
  if(result.statusCode!==200&&result.statusCode!==201)return {success:false,error:'チャンネル作成に失敗しました。'};
  var id=String(result.data.id); applyPermissionOverwrites_(token,id,guild,testDiscordConnection().botInfo.id); applyDiscordMemberPermissions_(token,id,[r.memberId].concat(ids)); customer.table.sheet.getRange(customer.rowIndex+2,customer.table.headerIndexes[channelHeader]).setValue(id); r.status='provisioned';saveDiscordCustomerInviteRecords_(records); if(!ids.length)Logger.log('Discord owner ID is not configured'); return {success:true,provisioned:1};
}
