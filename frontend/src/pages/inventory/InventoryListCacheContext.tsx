import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../../content/ja';
import type { InventoryRepository, SharedInventoryDto } from '../../features/inventory/contracts';

type InventoryListCache = {
  items: readonly SharedInventoryDto[] | undefined;
  error: string | undefined;
  loading: boolean;
  refreshing: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

const InventoryListCacheContext = createContext<InventoryListCache | null>(null);

export function InventoryListCacheProvider({ repository, children }: PropsWithChildren<{ repository: InventoryRepository }>) {
  const [items, setItems] = useState<readonly SharedInventoryDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const itemsRef = useRef<readonly SharedInventoryDto[] | undefined>(undefined);
  const inFlightRef = useRef<Promise<void> | undefined>(undefined);

  const request = useCallback((): Promise<void> => {
    const inFlight = inFlightRef.current;
    if (inFlight) return inFlight;

    setLoading(true);
    setError(undefined);
    const promise = repository.listSharedInventory()
      .then((records) => {
        itemsRef.current = records;
        setItems(records);
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
    return request();
  }, [request]);

  const refresh = useCallback(async () => {
    if (itemsRef.current === undefined) return;
    setRefreshing(true);
    await request();
    setRefreshing(false);
  }, [request]);

  const retry = useCallback(() => request(), [request]);

  return <InventoryListCacheContext.Provider value={{ items, error, loading, refreshing, ensureLoaded, refresh, retry }}>{children}</InventoryListCacheContext.Provider>;
}

export function useInventoryListCache() {
  const cache = useContext(InventoryListCacheContext);
  if (!cache) throw new Error('InventoryListCacheProvider is required.');
  return cache;
}
