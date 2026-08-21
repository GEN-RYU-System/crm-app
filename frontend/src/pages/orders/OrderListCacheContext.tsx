import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { OrderRecord, OrderRepository, OrderStatusOption } from '../../features/orders/contracts';

const { Provider: BaseProvider, useCache } = createListCache<OrderRecord>({ name: 'orders' });
const SymbolMapContext = createContext<Record<string, string>>({});
const StatusOptionsContext = createContext<readonly OrderStatusOption[]>([]);

export function OrderListCacheProvider({ repository, children }: PropsWithChildren<{ repository: OrderRepository }>) {
  const [symbolMap, setSymbolMap] = useState<Record<string, string>>({});
  const [statusOptions, setStatusOptions] = useState<readonly OrderStatusOption[]>([]);
  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    const [ordersResult, symbolsResult] = await Promise.allSettled([
      repository.listOrders(forceRefresh),
      repository.listCurrencySymbols(),
    ]);
    if (ordersResult.status === 'rejected') throw ordersResult.reason;
    if (symbolsResult.status === 'fulfilled') setSymbolMap(symbolsResult.value);
    return ordersResult.value;
  }, [repository]);

  useEffect(() => {
    repository.listStatusOptions().then(setStatusOptions).catch(() => {/* ignore — tabs fall back to empty */});
  }, [repository]);

  return (
    <StatusOptionsContext.Provider value={statusOptions}>
      <SymbolMapContext.Provider value={symbolMap}>
        <BaseProvider fetcher={fetcher}>{children}</BaseProvider>
      </SymbolMapContext.Provider>
    </StatusOptionsContext.Provider>
  );
}

export function useOrderListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const symbolMap = useContext(SymbolMapContext);
  const statusOptions = useContext(StatusOptionsContext);
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  return {
    items: itemsByKey[SINGLE_KEY],
    symbolMap,
    statusOptions,
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
  };
}
