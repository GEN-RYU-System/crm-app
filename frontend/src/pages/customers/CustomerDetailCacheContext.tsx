import { useCallback, type PropsWithChildren } from 'react';
import { createListCache } from '../../app/createListCache';
import type { CustomerAggregateDto, CustomerRepository } from '../../features/customers/contracts';

const { Provider: BaseProvider, useCache } = createListCache<CustomerAggregateDto, string>({ name: 'customer details' });

export function CustomerDetailCacheProvider({ repository, children }: PropsWithChildren<{ repository: CustomerRepository }>) {
  const fetcher = useCallback(async (customerId: string) => {
    const customer = await repository.getCustomer(customerId);
    return customer === null ? [] : [customer];
  }, [repository]);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useCustomerDetailCache() {
  const { itemsByKey, errorByKey, loadingByKey, ensureLoaded, retry } = useCache();
  return {
    recordsByCustomerId: itemsByKey,
    errorsByCustomerId: errorByKey,
    loadingByCustomerId: loadingByKey,
    ensureLoaded: useCallback((customerId: string) => ensureLoaded(customerId), [ensureLoaded]),
    retry: useCallback((customerId: string) => retry(customerId), [retry]),
  };
}
