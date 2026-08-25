import { createContext, useCallback, useContext, useRef, type MutableRefObject, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY } from '../../app/createListCache';
import type { DiscordConnectionStatus, DiscordIntegrationRepository, DiscordOAuthStatusResult, DiscordSetupStatus } from '../../features/discordIntegration/contracts';

export type DiscordSettingsSnapshot = {
  connectionStatus: DiscordConnectionStatus;
  channels: string[];
  oauthStatus: DiscordOAuthStatusResult;
  setupStatus: DiscordSetupStatus;
};

const { Provider: BaseProvider, useCache } = createListCache<DiscordSettingsSnapshot>({ name: 'discord settings' });
const LatestSettingsContext = createContext<MutableRefObject<DiscordSettingsSnapshot | null> | null>(null);

export function DiscordSettingsCacheProvider({ repository, children }: PropsWithChildren<{ repository: DiscordIntegrationRepository }>) {
  const latestSettingsRef = useRef<DiscordSettingsSnapshot | null>(null);
  const fetcher = useCallback(async () => {
    const [connectionStatus, channelsResult, oauthStatus, setupStatus] = await Promise.all([
      repository.getConnectionStatus(), repository.getChannels(), repository.getOAuthStatus(), repository.getSetupStatus(),
    ]);
    const settings = { connectionStatus, channels: channelsResult.channels, oauthStatus, setupStatus: { ...setupStatus, guildId: oauthStatus.guildId } };
    latestSettingsRef.current = settings;
    return [settings];
  }, [repository]);
  return (
    <LatestSettingsContext.Provider value={latestSettingsRef}>
      <BaseProvider fetcher={fetcher}>{children}</BaseProvider>
    </LatestSettingsContext.Provider>
  );
}

export function useDiscordSettingsCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const latestSettingsRef = useContext(LatestSettingsContext);
  return {
    settings: itemsByKey[SINGLE_KEY]?.[0] ?? null,
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: useCallback(() => ensureLoaded(), [ensureLoaded]),
    refresh: useCallback(() => refresh(), [refresh]),
    retry: useCallback(() => retry(), [retry]),
    getLatestSettings: useCallback(() => latestSettingsRef?.current ?? null, [latestSettingsRef]),
  };
}
