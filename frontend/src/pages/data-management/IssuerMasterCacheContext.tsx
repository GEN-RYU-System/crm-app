import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY } from '../../app/createListCache';
import { getCoreIssuer, type IssuerRecord } from '../../gas/client';

const { Provider: BaseProvider, useCache } = createListCache<IssuerRecord>({ name: 'issuer master' });

export function IssuerMasterCacheProvider({ children }: PropsWithChildren) {
  const fetcher = useCallback(async () => [await getCoreIssuer()], []);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useIssuerMasterCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  return {
    issuer: itemsByKey[SINGLE_KEY]?.[0] ?? null,
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: useCallback(() => ensureLoaded(), [ensureLoaded]),
    refresh: useCallback(() => refresh(), [refresh]),
    retry: useCallback(() => retry(), [retry]),
  };
}
