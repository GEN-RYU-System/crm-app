export type DiscordConnectionStatus = {
  isTokenSet: boolean;
  tokenMask: string;
  botName: string;
  botId: string;
  connected: boolean;
  clientId: string;
};

export type DiscordChannelsResult = {
  channels: string[];
};

export type DiscordSaveResult = {
  success: boolean;
  error?: string;
};

export type DiscordOAuthUrlResult = {
  success: boolean;
  url?: string;
  error?: string;
};

export type DiscordOAuthStatusResult = {
  status: 'linked' | 'unlinked' | 'multiple' | 'error';
  guildId: string | null;
  guilds: readonly { id: string; name: string }[];
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
  saveClientId: (clientId: string) => Promise<DiscordSaveResult>;
  getConnectionStatus: () => Promise<DiscordConnectionStatus>;
  saveChannels: (channelIds: string[]) => Promise<DiscordSaveResult>;
  getChannels: () => Promise<DiscordChannelsResult>;
  generateOAuthUrl: () => Promise<DiscordOAuthUrlResult>;
  getOAuthStatus: () => Promise<DiscordOAuthStatusResult>;
  saveGuildId: (guildId: string) => Promise<DiscordSaveResult>;
  runAutoSetup: () => Promise<DiscordAutoSetupResult>;
  getSetupStatus: () => Promise<DiscordSetupStatus>;
};
