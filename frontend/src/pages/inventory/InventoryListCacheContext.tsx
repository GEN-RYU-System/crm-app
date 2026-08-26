import { useMemo, useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { InventoryRepository, SharedInventoryDto } from '../../features/inventory/contracts';

const { Provider, useCache } = createListCache<SharedInventoryDto>({ name: 'inventory' });

export function InventoryListCacheProvider({ repository, children }: PropsWithChildren<{ repository: InventoryRepository }>) {
  const fetcher = useCallback((_: SingleKey, forceRefresh: boolean) => repository.listSharedInventory(forceRefresh), [repository]);
  return <Provider fetcher={fetcher}>{children}</Provider>;
}

export function useInventoryListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry, seed } = useCache();
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  const wrappedSeed = useCallback((items: readonly SharedInventoryDto[]) => seed(SINGLE_KEY, items), [seed]);
  return {
    items: itemsByKey[SINGLE_KEY],
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
    seed: wrappedSeed,
  };
}

/**
 * Derives a conditions map from the prefetched SharedInventoryDto[] cache.
 * Maps productId -> { condition, quantity, unitPrice, unitWeight }[].
 *
 * Only rows with quantity > 0 are included.
 * Returns an empty Map if the cache has not been loaded yet.
 * No GAS call is made.
 */
export function useInventoryConditionsMap(): Map<string, { condition: string; quantity: number; unitPrice: number; unitWeight: number }[]> {
  const { items } = useInventoryListCache();
  return useMemo(() => {
    const map = new Map<string, { condition: string; quantity: number; unitPrice: number; unitWeight: number }[]>();
    if (!items) return map;
    for (const item of items) {
      if (item.quantity <= 0) continue;
      const existing = map.get(item.productId) ?? [];
      existing.push({
        condition:  item.condition,
        quantity:   item.quantity,
        unitPrice:  item.unitPrice,
        unitWeight: item.unitWeight,
      });
      map.set(item.productId, existing);
    }
    return map;
  }, [items]);
}
