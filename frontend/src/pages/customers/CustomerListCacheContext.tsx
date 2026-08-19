import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../../content/ja';
import type { CustomerRepository, CustomerSummaryDto } from '../../features/customers/contracts';

type CustomerListCache = {
  customers: readonly CustomerSummaryDto[] | undefined;
  error: string | undefined;
  loading: boolean;
  refreshing: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

const CustomerListCacheContext = createContext<CustomerListCache | null>(null);

export function CustomerListCacheProvider({ repository, children }: PropsWithChildren<{ repository: CustomerRepository }>) {
  const [customers, setCustomers] = useState<readonly CustomerSummaryDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const customersRef = useRef<readonly CustomerSummaryDto[] | undefined>(undefined);
  const inFlightRef = useRef<Promise<void> | undefined>(undefined);

  const request = useCallback((forceRefresh: boolean): Promise<void> => {
    const inFlight = inFlightRef.current;
    if (inFlight) return inFlight;

    setLoading(true);
    setError(undefined);
    const promise = repository.listCustomers(forceRefresh)
      .then((records) => {
        customersRef.current = records;
        setCustomers(records);
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
    if (customersRef.current !== undefined) return Promise.resolve();
    return request(false);
  }, [request]);

  const refresh = useCallback(async () => {
    if (customersRef.current === undefined) return;
    setRefreshing(true);
    await request(true);
    setRefreshing(false);
  }, [request]);

  const retry = useCallback(() => request(false), [request]);

  return <CustomerListCacheContext.Provider value={{ customers, error, loading, refreshing, ensureLoaded, refresh, retry }}>{children}</CustomerListCacheContext.Provider>;
}

export function useCustomerListCache() {
  const cache = useContext(CustomerListCacheContext);
  if (!cache) throw new Error('CustomerListCacheProvider is required.');
  return cache;
}
