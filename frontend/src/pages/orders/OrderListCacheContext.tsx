import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../../content/ja';
import type { OrderRecord, OrderRepository } from '../../features/orders/contracts';

type OrderListCache = {
  items: readonly OrderRecord[] | undefined;
  symbolMap: Record<string, string>;
  error: string | undefined;
  loading: boolean;
  refreshing: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

const OrderListCacheContext = createContext<OrderListCache | null>(null);

export function OrderListCacheProvider({ repository, children }: PropsWithChildren<{ repository: OrderRepository }>) {
  const [items, setItems] = useState<readonly OrderRecord[] | undefined>(undefined);
  const [symbolMap, setSymbolMap] = useState<Record<string, string>>({});
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
      repository.listOrders(forceRefresh),
      repository.listCurrencySymbols(),
    ])
      .then(([ordersResult, symbolsResult]) => {
        if (ordersResult.status === 'rejected') throw ordersResult.reason;
        itemsRef.current = ordersResult.value;
        setItems(ordersResult.value);
        if (symbolsResult.status === 'fulfilled') {
          setSymbolMap(symbolsResult.value);
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
  }, [repository]);

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

  return <OrderListCacheContext.Provider value={{ items, symbolMap, error, loading, refreshing, ensureLoaded, refresh, retry }}>{children}</OrderListCacheContext.Provider>;
}

export function useOrderListCache() {
  const cache = useContext(OrderListCacheContext);
  if (!cache) throw new Error('OrderListCacheProvider is required.');
  return cache;
}
