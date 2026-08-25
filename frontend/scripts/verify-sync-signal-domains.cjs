const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const source = {
  sheetWrite: read('src/00_SheetWrite.js'),
  signalApi: read('src/29_SyncSignalApi.js'),
  issuer: read('src/28_CoreIssuerApi.js'),
  discordSettings: read('src/34_DiscordSettingsApi.js'),
  discordOAuth: read('src/35_DiscordOAuthApi.js'),
  discordSetup: read('src/36_DiscordChannelSetupApi.js'),
  discordInbox: read('src/33_DiscordIntegrationService.js'),
};

const stored = {};
const cache = {
  putAll(values) { Object.assign(stored, values); },
  put(key, value) { stored[key] = value; },
  getAll(keys) { return Object.fromEntries(keys.filter((key) => stored[key] != null).map((key) => [key, stored[key]])); },
};
const context = { CacheService: { getScriptCache: () => cache }, setEmailFromSession: () => {}, String, Object };
vm.createContext(context);
vm.runInContext(source.sheetWrite, context);
vm.runInContext(source.signalApi, context);

for (const domain of ['leads', 'quotes', 'orders', 'inventory', 'staff', 'customers']) {
  stored[`SYNC_SIGNAL_${domain}`] = `existing-${domain}`;
}
const before = context.checkSyncSignals('preview-session');
context.writeSyncSignalDomains_(['issuer', 'discord', 'inbox']);
const after = context.checkSyncSignals('preview-session');

const writeHooks = {
  issuer: /updateCoreIssuerForFrontend[\s\S]*writeSyncSignalDomains_\(\['issuer'\]\)/.test(source.issuer),
  discordSettings: ['saveDiscordBotToken', 'saveDiscordClientId', 'saveDiscordChannels'].every((name) => new RegExp(`${name}[\\s\\S]*?writeSyncSignalDomains_\\(\\['discord'\\]\\)`).test(source.discordSettings)),
  discordOAuth: /saveDiscordGuildId[\s\S]*writeSyncSignalDomains_\(\['discord'\]\)/.test(source.discordOAuth),
  discordSetup: /runDiscordAutoSetup[\s\S]*writeSyncSignalDomains_\(\['discord'\]\)/.test(source.discordSetup),
  inbox: /syncDiscordToConversationLog[\s\S]*savedCount > 0[\s\S]*writeSyncSignalDomains_\(\['inbox'\]\)/.test(source.discordInbox),
};

console.log('existing-six', JSON.stringify(before));
console.log('new-three', JSON.stringify({ issuer: after.issuer, discord: after.discord, inbox: after.inbox }));
console.log('write-hooks', JSON.stringify(writeHooks));
const passed = ['leads', 'quotes', 'orders', 'inventory', 'staff', 'customers'].every((domain) => before[domain] === `existing-${domain}`)
  && ['issuer', 'discord', 'inbox'].every((domain) => typeof after[domain] === 'string' && after[domain].length > 0)
  && Object.values(writeHooks).every(Boolean);
console.log(`PASS=${passed}`);
if (!passed) process.exitCode = 1;
