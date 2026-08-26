import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { OrderRecord, OrderRepository } from '../../features/orders/contracts';
import { useCurrencySymbolMap } from '../currency/CurrencyMasterCacheContext';

const { Provider: BaseProvider, useCache } = createListCache<OrderRecord>({ name: 'orders' });

export function OrderListCacheProvider({ repository, children }: PropsWithChildren<{ repository: OrderRepository }>) {
  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    return repository.listOrders(forceRefresh);
  }, [repository]);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useOrderListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry, seed: seedCache } = useCache();
  const symbolMap = useCurrencySymbolMap();
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  const seed = useCallback((orders: readonly OrderRecord[]) => seedCache(SINGLE_KEY, orders), [seedCache]);
  return {
    items: itemsByKey[SINGLE_KEY],
    symbolMap,
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
    seed,
  };
}
