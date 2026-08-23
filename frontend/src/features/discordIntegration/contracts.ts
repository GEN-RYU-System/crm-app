export type DiscordConnectionStatus = {
  isTokenSet: boolean;
  tokenMask: string;
  botName: string;
  botId: string;
  connected: boolean;
};

export type DiscordChannelsResult = {
  channels: string[];
};

export type DiscordSaveResult = {
  success: boolean;
  error?: string;
};

export type DiscordIntegrationRepository = {
  saveBotToken: (token: string) => Promise<DiscordSaveResult>;
  getConnectionStatus: () => Promise<DiscordConnectionStatus>;
  saveChannels: (channelIds: string[]) => Promise<DiscordSaveResult>;
  getChannels: () => Promise<DiscordChannelsResult>;
};
