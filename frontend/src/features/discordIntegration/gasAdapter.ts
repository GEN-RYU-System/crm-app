import {
  saveDiscordBotToken,
  getDiscordConnectionStatus,
  saveDiscordChannels,
  getDiscordChannels,
  generateDiscordOAuthUrl,
  getDiscordOAuthStatus,
} from '../../gas/client';
import type { DiscordIntegrationRepository } from './contracts';

export const discordIntegrationGasRepository: DiscordIntegrationRepository = {
  saveBotToken: (token) => saveDiscordBotToken(token),
  getConnectionStatus: () => getDiscordConnectionStatus(),
  saveChannels: (channelIds) => saveDiscordChannels(channelIds),
  getChannels: () => getDiscordChannels(),
  generateOAuthUrl: () => generateDiscordOAuthUrl(),
  getOAuthStatus: () => getDiscordOAuthStatus(),
};
