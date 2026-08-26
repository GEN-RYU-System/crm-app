import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import { getLeadsBatch, type LeadFormOptions, type LeadRecord } from '../../gas/client';

const { Provider, useCache } = createListCache<LeadFormOptions>({ name: 'lead form options' });

type LeadFormOptionsCacheProviderProps = PropsWithChildren<{
  onLeadsLoaded?: (leads: readonly LeadRecord[]) => void;
}>;

export function LeadFormOptionsCacheProvider({ children, onLeadsLoaded }: LeadFormOptionsCacheProviderProps) {
  const fetcher = useCallback(async (_: SingleKey, forceRefresh: boolean) => {
    const result = await getLeadsBatch(forceRefresh);
    onLeadsLoaded?.(result.leads);
    return [result.formOptions];
  }, [onLeadsLoaded]);
  return <Provider fetcher={fetcher}>{children}</Provider>;
}

export function useLeadFormOptionsCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  return {
    formOptions: itemsByKey[SINGLE_KEY]?.[0] ?? null,
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
  };
}
