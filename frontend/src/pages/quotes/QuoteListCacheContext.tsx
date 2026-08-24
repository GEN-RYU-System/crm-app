import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { QuoteRecord, QuoteRepository } from '../../features/quotes/contracts';
import { useCurrencySymbolMap } from '../currency/CurrencyMasterCacheContext';

const { Provider: BaseProvider, useCache } = createListCache<QuoteRecord>({ name: 'quotes' });

export function QuoteListCacheProvider({ repository, children }: PropsWithChildren<{ repository: QuoteRepository }>) {
  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    return repository.listQuotes(forceRefresh);
  }, [repository]);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useQuoteListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const symbolMap = useCurrencySymbolMap();
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
