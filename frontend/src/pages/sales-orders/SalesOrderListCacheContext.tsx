import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import { getCoreOrdersBatch, type OrderRecord, type OrderStatusOption } from '../../gas/client';

const { Provider: BaseProvider, useCache } = createListCache<OrderRecord>({ name: 'salesOrders' });
const StatusOptionsContext = createContext<readonly OrderStatusOption[]>([]);

type SalesOrderListCacheProviderProps = PropsWithChildren<{
  onOrdersLoaded?: (orders: readonly OrderRecord[]) => void;
}>;

export function SalesOrderListCacheProvider({ children, onOrdersLoaded }: SalesOrderListCacheProviderProps) {
  const [statusOptions, setStatusOptions] = useState<readonly OrderStatusOption[]>([]);

  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    const result = await getCoreOrdersBatch(forceRefresh);
    setStatusOptions(result.statusOptions);
    onOrdersLoaded?.(result.orders);
    return result.orders;
  }, [onOrdersLoaded]);

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
