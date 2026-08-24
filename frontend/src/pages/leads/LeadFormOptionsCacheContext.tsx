import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { LeadFormOptions, LeadRepository } from '../../features/leads/contracts';

const { Provider, useCache } = createListCache<LeadFormOptions>({ name: 'lead form options' });

export function LeadFormOptionsCacheProvider({ repository, children }: PropsWithChildren<{ repository: LeadRepository }>) {
  const fetcher = useCallback((_: SingleKey, __: boolean) => repository.getFormOptions().then((options) => [options]), [repository]);
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
