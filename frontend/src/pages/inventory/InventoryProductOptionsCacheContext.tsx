import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import { getInventoryBatch, type InventoryProductOption, type SharedInventoryItem } from '../../gas/client';

const { Provider: BaseProvider, useCache } = createListCache<InventoryProductOption>({ name: 'inventory product options' });

type InventoryProductOptionsCacheProviderProps = PropsWithChildren<{
  onInventoryLoaded?: (inventory: readonly SharedInventoryItem[]) => void;
}>;

export function InventoryProductOptionsCacheProvider({ children, onInventoryLoaded }: InventoryProductOptionsCacheProviderProps) {
  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    const result = await getInventoryBatch(forceRefresh);
    onInventoryLoaded?.(result.inventory);
    return result.productOptions;
  }, [onInventoryLoaded]);
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
