import {
  saveDiscordBotToken,
  saveDiscordClientId,
  getDiscordConnectionStatus,
  saveDiscordChannels,
  getDiscordChannels,
  generateDiscordOAuthUrl,
  getDiscordOAuthStatus,
  saveDiscordGuildId,
  runDiscordAutoSetup,
  getDiscordSetupStatus,
} from '../../gas/client';
import type { DiscordIntegrationRepository } from './contracts';

export const discordIntegrationGasRepository: DiscordIntegrationRepository = {
  saveBotToken: (token) => saveDiscordBotToken(token),
  saveClientId: (clientId) => saveDiscordClientId(clientId),
  getConnectionStatus: () => getDiscordConnectionStatus(),
  saveChannels: (channelIds) => saveDiscordChannels(channelIds),
  getChannels: () => getDiscordChannels(),
  generateOAuthUrl: () => generateDiscordOAuthUrl(),
  getOAuthStatus: () => getDiscordOAuthStatus(),
  saveGuildId: (guildId) => saveDiscordGuildId(guildId),
  runAutoSetup: () => runDiscordAutoSetup(),
  getSetupStatus: () => getDiscordSetupStatus(),
};
