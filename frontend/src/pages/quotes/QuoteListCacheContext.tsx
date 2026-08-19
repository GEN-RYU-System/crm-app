import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../../content/ja';
import type { QuoteRecord, QuoteRepository } from '../../features/quotes/contracts';

type QuoteListCache = {
  items: readonly QuoteRecord[] | undefined;
  symbolMap: Record<string, string>;
  error: string | undefined;
  loading: boolean;
  refreshing: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

const QuoteListCacheContext = createContext<QuoteListCache | null>(null);

export function QuoteListCacheProvider({ repository, children }: PropsWithChildren<{ repository: QuoteRepository }>) {
  const [items, setItems] = useState<readonly QuoteRecord[] | undefined>(undefined);
  const [symbolMap, setSymbolMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const itemsRef = useRef<readonly QuoteRecord[] | undefined>(undefined);
  const inFlightRef = useRef<Promise<void> | undefined>(undefined);

  const request = useCallback((forceRefresh: boolean): Promise<void> => {
    const inFlight = inFlightRef.current;
    if (inFlight) return inFlight;

    setLoading(true);
    setError(undefined);
    const promise = Promise.allSettled([
      repository.listQuotes(forceRefresh),
      repository.listCurrencySymbols(),
    ])
      .then(([quotesResult, symbolsResult]) => {
        if (quotesResult.status === 'rejected') throw quotesResult.reason;
        itemsRef.current = quotesResult.value;
        setItems(quotesResult.value);
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

  return <QuoteListCacheContext.Provider value={{ items, symbolMap, error, loading, refreshing, ensureLoaded, refresh, retry }}>{children}</QuoteListCacheContext.Provider>;
}

export function useQuoteListCache() {
  const cache = useContext(QuoteListCacheContext);
  if (!cache) throw new Error('QuoteListCacheProvider is required.');
  return cache;
}
