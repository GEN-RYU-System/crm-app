import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { OrderRecord, OrderRepository } from '../../features/orders/contracts';

const { Provider: BaseProvider, useCache } = createListCache<OrderRecord>({ name: 'orders' });
const SymbolMapContext = createContext<Record<string, string>>({});

export function OrderListCacheProvider({ repository, children }: PropsWithChildren<{ repository: OrderRepository }>) {
  const [symbolMap, setSymbolMap] = useState<Record<string, string>>({});
  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    const [ordersResult, symbolsResult] = await Promise.allSettled([
      repository.listOrders(forceRefresh),
      repository.listCurrencySymbols(),
    ]);
    if (ordersResult.status === 'rejected') throw ordersResult.reason;
    if (symbolsResult.status === 'fulfilled') setSymbolMap(symbolsResult.value);
    return ordersResult.value;
  }, [repository]);
  return (
    <SymbolMapContext.Provider value={symbolMap}>
      <BaseProvider fetcher={fetcher}>{children}</BaseProvider>
    </SymbolMapContext.Provider>
  );
}

export function useOrderListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const symbolMap = useContext(SymbolMapContext);
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  return {
    items: itemsByKey[SINGLE_KEY],
    symbolMap,
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
  };
}
