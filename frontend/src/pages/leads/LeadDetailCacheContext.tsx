import { useCallback, type PropsWithChildren } from 'react';
import { createListCache } from '../../app/createListCache';
import type { LeadRecord } from '../../gas/client';
import type { LeadRepository } from '../../features/leads/contracts';

const { Provider: BaseProvider, useCache } = createListCache<LeadRecord, string>({ name: 'lead details' });

export function LeadDetailCacheProvider({ repository, children }: PropsWithChildren<{ repository: LeadRepository }>) {
  const fetcher = useCallback(async (leadId: string) => {
    const record = await repository.getDetail(leadId);
    return record === null ? [] : [record];
  }, [repository]);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useLeadDetailCache() {
  const { itemsByKey, errorByKey, loadingByKey, ensureLoaded, retry } = useCache();
  return {
    recordsByLeadId: itemsByKey,
    errorsByLeadId: errorByKey,
    loadingByLeadId: loadingByKey,
    ensureLoaded: useCallback((leadId: string) => ensureLoaded(leadId), [ensureLoaded]),
    retry: useCallback((leadId: string) => retry(leadId), [retry]),
  };
}
