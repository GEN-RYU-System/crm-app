import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../../content/ja';
import type { StaffRepository, StaffSummaryDto } from '../../features/staff/contracts';

type StaffListCache = {
  items: readonly StaffSummaryDto[] | undefined;
  error: string | undefined;
  loading: boolean;
  refreshing: boolean;
  ensureLoaded: () => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

const StaffListCacheContext = createContext<StaffListCache | null>(null);

export function StaffListCacheProvider({ repository, children }: PropsWithChildren<{ repository: StaffRepository }>) {
  const [items, setItems] = useState<readonly StaffSummaryDto[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const itemsRef = useRef<readonly StaffSummaryDto[] | undefined>(undefined);
  const inFlightRef = useRef<Promise<void> | undefined>(undefined);

  const request = useCallback((forceRefresh: boolean): Promise<void> => {
    const inFlight = inFlightRef.current;
    if (inFlight) return inFlight;

    setLoading(true);
    setError(undefined);
    const promise = repository.listStaff(forceRefresh)
      .then((records) => {
        itemsRef.current = records;
        setItems(records);
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

  return <StaffListCacheContext.Provider value={{ items, error, loading, refreshing, ensureLoaded, refresh, retry }}>{children}</StaffListCacheContext.Provider>;
}

export function useStaffListCache() {
  const cache = useContext(StaffListCacheContext);
  if (!cache) throw new Error('StaffListCacheProvider is required.');
  return cache;
}
