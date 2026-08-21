import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../../content/ja';
import { getCoreOrders, getCoreOrderStatusOptions, type OrderRecord, type OrderStatusOption } from '../../gas/client';

type SalesOrderListCache = {
  items: readonly OrderRecord[] | undefined;
  statusOptions: readonly OrderStatusOption[] | undefined;
  error: string | undefined;
  loading: boolean;
  refreshing: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

const SalesOrderListCacheContext = createContext<SalesOrderListCache | null>(null);

export function SalesOrderListCacheProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<readonly OrderRecord[] | undefined>(undefined);
  const [statusOptions, setStatusOptions] = useState<readonly OrderStatusOption[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const itemsRef = useRef<readonly OrderRecord[] | undefined>(undefined);
  const inFlightRef = useRef<Promise<void> | undefined>(undefined);

  const request = useCallback((forceRefresh: boolean): Promise<void> => {
    const inFlight = inFlightRef.current;
    if (inFlight) return inFlight;

    setLoading(true);
    setError(undefined);
    const promise = Promise.allSettled([
      getCoreOrders(forceRefresh),
      getCoreOrderStatusOptions(),
    ])
      .then(([ordersResult, statusResult]) => {
        if (ordersResult.status === 'rejected') throw ordersResult.reason;
        itemsRef.current = ordersResult.value;
        setItems(ordersResult.value);
        if (statusResult.status === 'fulfilled') {
          setStatusOptions(statusResult.value);
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : errorCopy.genericLoad);
      })
      .finally(() => {
        inFlightRef.current = undefined;
        setLoading(false);
      });

    inFlightRef.current = promise;
    return promise;
  }, []);

  const ensureLoaded = useCallback(() => {
    if (itemsRef.current !== undefined) return Promise.resolve();
    return request(false);
  }, [request]);

  const refresh = useCallback(async () => {
    if (itemsRef.current === undefined) return;
    setRefreshing(true);
    await request(true);
    setRefreshing(false);
  }, [request]);

  const retry = useCallback(() => request(false), [request]);

  return (
    <SalesOrderListCacheContext.Provider value={{ items, statusOptions, error, loading, refreshing, ensureLoaded, refresh, retry }}>
      {children}
    </SalesOrderListCacheContext.Provider>
  );
}

export function useSalesOrderListCache() {
  const cache = useContext(SalesOrderListCacheContext);
  if (!cache) throw new Error('SalesOrderListCacheProvider is required.');
  return cache;
}
