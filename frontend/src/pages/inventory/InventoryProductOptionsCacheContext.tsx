import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY } from '../../app/createListCache';
import { getInventoryProductOptions, type InventoryProductOption } from '../../gas/client';

const { Provider: BaseProvider, useCache } = createListCache<InventoryProductOption>({ name: 'inventory product options' });

export function InventoryProductOptionsCacheProvider({ children }: PropsWithChildren) {
  const fetcher = useCallback(() => getInventoryProductOptions(), []);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useInventoryProductOptionsCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  return {
    products: itemsByKey[SINGLE_KEY] ?? [],
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: useCallback(() => ensureLoaded(), [ensureLoaded]),
    refresh: useCallback(() => refresh(), [refresh]),
    retry: useCallback(() => retry(), [retry]),
  };
}
