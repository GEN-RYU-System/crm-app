import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import { getCoreOrders, getCoreOrderStatusOptions, type OrderRecord, type OrderStatusOption } from '../../gas/client';

const { Provider: BaseProvider, useCache } = createListCache<OrderRecord>({ name: 'salesOrders' });
const StatusOptionsContext = createContext<readonly OrderStatusOption[]>([]);

export function SalesOrderListCacheProvider({ children }: PropsWithChildren) {
  const [statusOptions, setStatusOptions] = useState<readonly OrderStatusOption[]>([]);

  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    const [ordersResult, statusResult] = await Promise.allSettled([
      getCoreOrders(forceRefresh),
      getCoreOrderStatusOptions(),
    ]);
    if (ordersResult.status === 'rejected') throw ordersResult.reason;
    if (statusResult.status === 'fulfilled') setStatusOptions(statusResult.value);
    return ordersResult.value;
  }, []);

  return (
    <StatusOptionsContext.Provider value={statusOptions}>
      <BaseProvider fetcher={fetcher}>{children}</BaseProvider>
    </StatusOptionsContext.Provider>
  );
}

export function useSalesOrderListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const statusOptions = useContext(StatusOptionsContext);
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  return {
    items: itemsByKey[SINGLE_KEY],
    statusOptions,
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
  };
}
