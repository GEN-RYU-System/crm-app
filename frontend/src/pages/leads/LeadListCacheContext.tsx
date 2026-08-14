import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { errorCopy } from '../../content/ja';
import { getLeadsByType, type LeadRecord, type LeadType } from '../../gas/client';
import { LEAD_LIST_TABS } from './leadListConfig';

type RecordsByType = Partial<Record<LeadType, LeadRecord[]>>;
type ErrorsByType = Partial<Record<LeadType, string>>;
type LoadingByType = Partial<Record<LeadType, boolean>>;

type LeadListCache = {
  recordsByType: RecordsByType;
  errorsByType: ErrorsByType;
  loadingByType: LoadingByType;
  refreshing: boolean;
  ensureLoaded: (type: LeadType) => Promise<void>;
  refreshAll: () => Promise<void>;
  retryType: (type: LeadType) => Promise<void>;
};

const LeadListCacheContext = createContext<LeadListCache | null>(null);

export function LeadListCacheProvider({ children }: PropsWithChildren) {
  const [recordsByType, setRecordsByType] = useState<RecordsByType>({});
  const [errorsByType, setErrorsByType] = useState<ErrorsByType>({});
  const [loadingByType, setLoadingByType] = useState<LoadingByType>({});
  const [refreshing, setRefreshing] = useState(false);
  const recordsRef = useRef<RecordsByType>({});
  const inFlightRef = useRef<Partial<Record<LeadType, Promise<void>>>>({});

  const requestType = useCallback((type: LeadType): Promise<void> => {
    const inFlight = inFlightRef.current[type];
    if (inFlight) return inFlight;

    setLoadingByType((previous) => ({ ...previous, [type]: true }));
    setErrorsByType((previous) => ({ ...previous, [type]: undefined }));
    const request = getLeadsByType(type)
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

  const ensureLoaded = useCallback((type: LeadType) => {
    if (recordsRef.current[type] !== undefined) return Promise.resolve();
    return requestType(type);
  }, [requestType]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all(LEAD_LIST_TABS.map(({ type }) => requestType(type)));
    setRefreshing(false);
  }, [requestType]);

  const retryType = useCallback((type: LeadType) => requestType(type), [requestType]);

  return <LeadListCacheContext.Provider value={{ recordsByType, errorsByType, loadingByType, refreshing, ensureLoaded, refreshAll, retryType }}>{children}</LeadListCacheContext.Provider>;
}

export function useLeadListCache() {
  const cache = useContext(LeadListCacheContext);
  if (!cache) throw new Error('LeadListCacheProvider is required.');
  return cache;
}
