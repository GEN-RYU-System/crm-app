import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../content/ja';

export const SINGLE_KEY = '__single__' as const;
export type SingleKey = typeof SINGLE_KEY;

export type Fetcher<K extends string, T> = (key: K, forceRefresh: boolean) => Promise<readonly T[]>;

export type CacheValue<K extends string, T> = {
  itemsByKey: Partial<Record<K, readonly T[]>>;
  errorByKey: Partial<Record<K, string>>;
  loadingByKey: Partial<Record<K, boolean>>;
  refreshing: boolean;
  ensureLoaded: (key?: K) => Promise<void>;
  refresh: (key?: K) => Promise<void>;
  retry: (key?: K) => Promise<void>;
  seed: (key: K, items: readonly T[]) => void;
};

export function createListCache<T, K extends string = SingleKey>(options: { name: string; keys?: readonly K[] }) {
  const Context = createContext<CacheValue<K, T> | null>(null);

  function Provider({ fetcher, children }: PropsWithChildren<{ fetcher: Fetcher<K, T> }>) {
    const [itemsByKey, setItemsByKey] = useState<Partial<Record<K, readonly T[]>>>({});
    const [errorByKey, setErrorByKey] = useState<Partial<Record<K, string>>>({});
    const [loadingByKey, setLoadingByKey] = useState<Partial<Record<K, boolean>>>({});
    const [refreshing, setRefreshing] = useState(false);
    const itemsRef = useRef<Partial<Record<K, readonly T[]>>>({});
    const inFlightRef = useRef<Partial<Record<K, Promise<void>>>>({});
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const requestKey = useCallback((key: K, forceRefresh?: boolean): Promise<void> => {
      const existing = inFlightRef.current[key];
      if (existing) return existing;
      setLoadingByKey((prev) => ({ ...prev, [key]: true }));
      setErrorByKey((prev) => ({ ...prev, [key]: undefined }));
      const promise = fetcherRef.current(key, forceRefresh === true)
        .then((records) => {
          setItemsByKey((prev) => {
            const next = { ...prev, [key]: records };
            itemsRef.current = next;
            return next;
          });
        })
        .catch((cause) => {
          setErrorByKey((prev) => ({ ...prev, [key]: cause instanceof Error ? cause.message : errorCopy.genericLoad }));
        })
        .finally(() => {
          inFlightRef.current[key] = undefined;
          setLoadingByKey((prev) => ({ ...prev, [key]: false }));
        });
      inFlightRef.current[key] = promise;
      return promise;
    }, []);

    const ensureLoaded = useCallback((key?: K): Promise<void> => {
      const k = (key ?? SINGLE_KEY) as K;
      if (itemsRef.current[k] !== undefined) return Promise.resolve();
      return requestKey(k);
    }, [requestKey]);

    const refresh = useCallback(async (key?: K): Promise<void> => {
      const targets = key != null ? [key] : (Object.keys(itemsRef.current) as K[]);
      if (targets.length === 0) return;
      setRefreshing(true);
      await Promise.all(targets.map((k) => requestKey(k, true)));
      setRefreshing(false);
    }, [requestKey]);

    const retry = useCallback((key?: K): Promise<void> => {
      const k = (key ?? SINGLE_KEY) as K;
      return requestKey(k);
    }, [requestKey]);

    const seed = useCallback((key: K, items: readonly T[]) => {
      setItemsByKey((prev) => {
        if (prev[key] !== undefined) return prev;
        const next = { ...prev, [key]: items };
        itemsRef.current = next;
        return next;
      });
    }, []);

    return (
      <Context.Provider value={{ itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry, seed }}>
        {children}
      </Context.Provider>
    );
  }

  function useCache(): CacheValue<K, T> {
    const cache = useContext(Context);
    if (!cache) throw new Error(`${options.name} CacheProvider is required.`);
    return cache;
  }

  return { Provider, useCache };
}
