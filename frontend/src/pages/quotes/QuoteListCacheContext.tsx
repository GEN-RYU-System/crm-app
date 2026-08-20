import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { QuoteRecord, QuoteRepository } from '../../features/quotes/contracts';

const { Provider: BaseProvider, useCache } = createListCache<QuoteRecord>({ name: 'quotes' });
const SymbolMapContext = createContext<Record<string, string>>({});

export function QuoteListCacheProvider({ repository, children }: PropsWithChildren<{ repository: QuoteRepository }>) {
  const [symbolMap, setSymbolMap] = useState<Record<string, string>>({});
  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    const [quotesResult, symbolsResult] = await Promise.allSettled([
      repository.listQuotes(forceRefresh),
      repository.listCurrencySymbols(),
    ]);
    if (quotesResult.status === 'rejected') throw quotesResult.reason;
    if (symbolsResult.status === 'fulfilled') setSymbolMap(symbolsResult.value);
    return quotesResult.value;
  }, [repository]);
  return (
    <SymbolMapContext.Provider value={symbolMap}>
      <BaseProvider fetcher={fetcher}>{children}</BaseProvider>
    </SymbolMapContext.Provider>
  );
}

export function useQuoteListCache() {
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
