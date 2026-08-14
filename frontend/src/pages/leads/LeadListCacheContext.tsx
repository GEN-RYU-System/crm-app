import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../../content/ja';
import { getLeadsByType, type LeadRecord } from '../../gas/client';
import type { LeadListTabType } from './leadListConfig';

type RecordsByType = Partial<Record<LeadListTabType, LeadRecord[]>>;
type ErrorsByType = Partial<Record<LeadListTabType, string>>;
type LoadingByType = Partial<Record<LeadListTabType, boolean>>;

type LeadListCache = {
  recordsByType: RecordsByType;
  errorsByType: ErrorsByType;
  loadingByType: LoadingByType;
  refreshing: boolean;
  ensureLoaded: (type: LeadListTabType) => Promise<void>;
  refreshAll: () => Promise<void>;
  retryType: (type: LeadListTabType) => Promise<void>;
};

const LeadListCacheContext = createContext<LeadListCache | null>(null);

export function LeadListCacheProvider({ children }: PropsWithChildren) {
  const [recordsByType, setRecordsByType] = useState<RecordsByType>({});
  const [errorsByType, setErrorsByType] = useState<ErrorsByType>({});
  const [loadingByType, setLoadingByType] = useState<LoadingByType>({});
  const [refreshing, setRefreshing] = useState(false);
  const recordsRef = useRef<RecordsByType>({});
  const inFlightRef = useRef<Partial<Record<LeadListTabType, Promise<void>>>>({});

  const requestType = useCallback((type: LeadListTabType): Promise<void> => {
    const inFlight = inFlightRef.current[type];
    if (inFlight) return inFlight;

    setLoadingByType((previous) => ({ ...previous, [type]: true }));
    setErrorsByType((previous) => ({ ...previous, [type]: undefined }));
    const request = getLeadsByType(type === 'all' ? undefined : type)
      .then((records) => {
        setRecordsByType((previous) => {
          const next = { ...previous, [type]: records };
          recordsRef.current = next;
          return next;
        });
      })
      .catch((cause) => {
        setErrorsByType((previous) => ({ ...previous, [type]: cause instanceof Error ? cause.message : errorCopy.genericLoad }));
      })
      .finally(() => {
        inFlightRef.current[type] = undefined;
        setLoadingByType((previous) => ({ ...previous, [type]: false }));
      });

    inFlightRef.current[type] = request;
    return request;
  }, []);

  const ensureLoaded = useCallback((type: LeadListTabType) => {
    if (recordsRef.current[type] !== undefined) return Promise.resolve();
    return requestType(type);
  }, [requestType]);

  const refreshAll = useCallback(async () => {
    const loadedTypes = Object.keys(recordsRef.current) as LeadListTabType[];
    if (loadedTypes.length === 0) return;
    setRefreshing(true);
    await Promise.all(loadedTypes.map((type) => requestType(type)));
    setRefreshing(false);
  }, [requestType]);

  const retryType = useCallback((type: LeadListTabType) => requestType(type), [requestType]);

  return <LeadListCacheContext.Provider value={{ recordsByType, errorsByType, loadingByType, refreshing, ensureLoaded, refreshAll, retryType }}>{children}</LeadListCacheContext.Provider>;
}

export function useLeadListCache() {
  const cache = useContext(LeadListCacheContext);
  if (!cache) throw new Error('LeadListCacheProvider is required.');
  return cache;
}
