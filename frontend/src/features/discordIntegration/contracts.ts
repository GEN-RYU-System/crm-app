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

export type DiscordAutoSetupResult = {
  success: boolean;
  categoryId?: string;
  ticketChannelId?: string;
  error?: string;
};

export type DiscordSetupStatus = {
  guildId: string | null;
  categoryId: string | null;
  ticketChannelId: string | null;
};

export type DiscordIntegrationRepository = {
  saveBotToken: (token: string) => Promise<DiscordSaveResult>;
  getConnectionStatus: () => Promise<DiscordConnectionStatus>;
  saveChannels: (channelIds: string[]) => Promise<DiscordSaveResult>;
  getChannels: () => Promise<DiscordChannelsResult>;
  runAutoSetup: () => Promise<DiscordAutoSetupResult>;
  getSetupStatus: () => Promise<DiscordSetupStatus>;
};
