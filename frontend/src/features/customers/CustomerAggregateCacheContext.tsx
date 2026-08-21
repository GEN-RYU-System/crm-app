import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import type { CustomerAggregatesRecord, CustomerRepository } from './contracts';

type CacheState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: CustomerAggregatesRecord }
  | { status: 'error' };

type CacheValue = {
  state: CacheState;
  ensureLoaded: () => Promise<void>;
};

const Context = createContext<CacheValue | null>(null);

export function CustomerAggregateCacheProvider({ repository, children }: PropsWithChildren<{ repository: CustomerRepository }>) {
  const [cacheState, setCacheState] = useState<CacheState>({ status: 'idle' });
  const stateRef = useRef<CacheState>({ status: 'idle' });
  const inFlightRef = useRef<Promise<void> | null>(null);
  const repositoryRef = useRef(repository);
  repositoryRef.current = repository;

  const ensureLoaded = useCallback((): Promise<void> => {
    if (stateRef.current.status === 'ready') return Promise.resolve();
    if (inFlightRef.current) return inFlightRef.current;
    const next: CacheState = { status: 'loading' };
    stateRef.current = next;
    setCacheState(next);
    const promise = repositoryRef.current.listCustomerAggregates()
      .then((data) => {
        const ready: CacheState = { status: 'ready', data };
        stateRef.current = ready;
        setCacheState(ready);
      })
      .catch(() => {
        const error: CacheState = { status: 'error' };
        stateRef.current = error;
        setCacheState(error);
      })
      .finally(() => {
        inFlightRef.current = null;
      });
    inFlightRef.current = promise;
    return promise;
  }, []);

  return (
    <Context.Provider value={{ state: cacheState, ensureLoaded }}>
      {children}
    </Context.Provider>
  );
}

export function useCustomerAggregateCache(): CacheValue {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useCustomerAggregateCache must be used inside CustomerAggregateCacheProvider');
  return ctx;
}
