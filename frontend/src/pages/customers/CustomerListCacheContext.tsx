import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { CustomerRepository, CustomerSummaryDto } from '../../features/customers/contracts';

const { Provider, useCache } = createListCache<CustomerSummaryDto>({ name: 'customers' });

export function CustomerListCacheProvider({ repository, children }: PropsWithChildren<{ repository: CustomerRepository }>) {
  const fetcher = useCallback((_: SingleKey, forceRefresh: boolean) => repository.listCustomers(forceRefresh), [repository]);
  return <Provider fetcher={fetcher}>{children}</Provider>;
}

export function useCustomerListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  const wrappedEnsureLoaded = useCallback(() => ensureLoaded(), [ensureLoaded]);
  const wrappedRefresh = useCallback(() => refresh(), [refresh]);
  const wrappedRetry = useCallback(() => retry(), [retry]);
  return {
    customers: itemsByKey[SINGLE_KEY],
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: wrappedEnsureLoaded,
    refresh: wrappedRefresh,
    retry: wrappedRetry,
  };
}
