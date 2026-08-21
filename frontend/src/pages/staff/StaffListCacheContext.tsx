import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { StaffRepository, StaffSummaryDto } from '../../features/staff/contracts';

const { Provider, useCache } = createListCache<StaffSummaryDto>({ name: 'staff' });

export function StaffListCacheProvider({ repository, children }: PropsWithChildren<{ repository: StaffRepository }>) {
  const fetcher = useCallback((_: SingleKey, forceRefresh: boolean) => repository.listStaff(forceRefresh), [repository]);
  return <Provider fetcher={fetcher}>{children}</Provider>;
}

export function useStaffListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  return {
    items: itemsByKey[SINGLE_KEY],
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
  };
}
