import { useCallback, type PropsWithChildren } from 'react';
import { createListCache } from '../../app/createListCache';
import { getLeadsByType, type LeadRecord } from '../../gas/client';
import type { LeadListTabType } from './leadListConfig';

type RecordsByType = Partial<Record<LeadListTabType, LeadRecord[]>>;
type ErrorsByType = Partial<Record<LeadListTabType, string>>;
type LoadingByType = Partial<Record<LeadListTabType, boolean>>;

const { Provider, useCache } = createListCache<LeadRecord, LeadListTabType>({ name: 'leads' });

export function LeadListCacheProvider({ children }: PropsWithChildren) {
  const fetcher = useCallback(
    (type: LeadListTabType, forceRefresh: boolean) => getLeadsByType(type === 'all' ? undefined : type, forceRefresh),
    [],
  );
  return <Provider fetcher={fetcher}>{children}</Provider>;
}

export function useLeadListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry, seed } = useCache();
  const refreshAll = useCallback(() => refresh(), [refresh]);
  const seedAll = useCallback((leads: readonly LeadRecord[]) => seed('all', leads), [seed]);
  return {
    recordsByType: itemsByKey as unknown as RecordsByType,
    errorsByType: errorByKey as ErrorsByType,
    loadingByType: loadingByKey as LoadingByType,
    refreshing,
    ensureLoaded,
    refreshAll,
    retryType: retry,
    seed: seedAll,
  };
}
