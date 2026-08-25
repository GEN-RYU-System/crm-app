var DISCORD_INVITE_MEMBER_SNAPSHOT_PROPERTY = 'DISCORD_INVITE_MEMBER_SNAPSHOT';
var DISCORD_INVITE_REVIEW_QUEUE_PROPERTY = 'DISCORD_INVITE_REVIEW_QUEUE';

function syncDiscordInviteUsage() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { success: true, skipped: true, reason: 'LOCKED' };
  var started = new Date().getTime();
  var fetchCount = 0;
  try {
    var props = PropertiesService.getScriptProperties();
    var guildId = props.getProperty('DISCORD_GUILD_ID');
    var botToken = props.getProperty('DISCORD_BOT_TOKEN');
    if (!guildId || !botToken) return { success: false, error: 'Discord連携設定が未完了です。' };
    var invitesResult = discordRequest_(botToken, 'get', '/guilds/' + guildId + '/invites', null); fetchCount++;
    if (invitesResult.statusCode !== 200) return { success: false, error: '招待一覧を取得できませんでした。' };
    var membersResult = discordRequest_(botToken, 'get', '/guilds/' + guildId + '/members?limit=1000', null); fetchCount++;
    if (membersResult.statusCode !== 200) return { success: false, error: '参加メンバー一覧を取得できませんでした。GUILD_MEMBERS Intentを確認してください。' };
    var activeCodes = new Set((Array.isArray(invitesResult.data) ? invitesResult.data : []).map(function(invite) { return String(invite.code || ''); }));
    var records = getDiscordCustomerInviteRecords_();
    var used = records.filter(function(record) { return record.status === 'issued' && !activeCodes.has(record.code); });
    var members = (Array.isArray(membersResult.data) ? membersResult.data : []).map(function(member) { return String(member.user && member.user.id || ''); }).filter(Boolean);
    var previous = JSON.parse(props.getProperty(DISCORD_INVITE_MEMBER_SNAPSHOT_PROPERTY) || '[]');
    var newMembers = members.filter(function(id) { return previous.indexOf(id) === -1; });
    props.setProperty(DISCORD_INVITE_MEMBER_SNAPSHOT_PROPERTY, JSON.stringify(members));
    var queue = JSON.parse(props.getProperty(DISCORD_INVITE_REVIEW_QUEUE_PROPERTY) || '[]');
    if (used.length) {
      var status = used.length === 1 && newMembers.length === 1 ? 'ready' : 'review';
      used.forEach(function(record) { record.status = status; record.memberId = status === 'ready' ? newMembers[0] : null; });
      queue.push({ id: Utilities.getUuid(), status: status, customerIds: used.map(function(record) { return record.customerId; }), memberIds: newMembers, createdAt: new Date().toISOString() });
      saveDiscordCustomerInviteRecords_(records); props.setProperty(DISCORD_INVITE_REVIEW_QUEUE_PROPERTY, JSON.stringify(queue));
    }
    return { success: true, usedCount: used.length, newMemberCount: newMembers.length, fetchCount: fetchCount, durationMs: new Date().getTime() - started };
  } catch (error) { Logger.log('syncDiscordInviteUsage error: ' + error.message); return { success: false, error: '招待使用状況の同期に失敗しました。' }; }
  finally { lock.releaseLock(); }
}

function setupDiscordInviteUsageTrigger() {
  ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === 'syncDiscordInviteUsage'; }).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('syncDiscordInviteUsage').timeBased().everyMinutes(5).create();
  return { success: true };
}
