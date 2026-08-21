import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { InventoryRepository, SharedInventoryDto } from '../../features/inventory/contracts';

const { Provider, useCache } = createListCache<SharedInventoryDto>({ name: 'inventory' });

export function InventoryListCacheProvider({ repository, children }: PropsWithChildren<{ repository: InventoryRepository }>) {
  const fetcher = useCallback((_: SingleKey, forceRefresh: boolean) => repository.listSharedInventory(forceRefresh), [repository]);
  return <Provider fetcher={fetcher}>{children}</Provider>;
}

export function useInventoryListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  return {
    items: itemsByKey[SINGLE_KEY],
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
  };
}
