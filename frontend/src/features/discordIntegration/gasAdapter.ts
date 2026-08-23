import {
  saveDiscordBotToken,
  getDiscordConnectionStatus,
  saveDiscordChannels,
  getDiscordChannels,
  runDiscordAutoSetup,
  getDiscordSetupStatus,
} from '../../gas/client';
import type { DiscordIntegrationRepository } from './contracts';

export const discordIntegrationGasRepository: DiscordIntegrationRepository = {
  saveBotToken: (token) => saveDiscordBotToken(token),
  getConnectionStatus: () => getDiscordConnectionStatus(),
  saveChannels: (channelIds) => saveDiscordChannels(channelIds),
  getChannels: () => getDiscordChannels(),
  runAutoSetup: () => runDiscordAutoSetup(),
  getSetupStatus: () => getDiscordSetupStatus(),
};
