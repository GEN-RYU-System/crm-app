import { useCallback, type PropsWithChildren } from 'react';
import { createListCache } from '../../app/createListCache';
import type { InboxConversationDetailDto, InboxRepository } from '../../features/inbox/contracts';
const { Provider, useCache } = createListCache<InboxConversationDetailDto, string>({ name: 'inbox detail' });
export function InboxDetailCacheProvider({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) {
  const fetcher = useCallback(async (leadId: string) => { const detail = await repository.getConversation(leadId); return detail ? [detail] : []; }, [repository]);
  return <Provider fetcher={fetcher}>{children}</Provider>;
}
export function useInboxDetailCache() {
  const { itemsByKey, loadingByKey, ensureLoaded, refresh } = useCache();
  const ensureDetail = useCallback((leadId: string, revalidate = false) => revalidate ? refresh(leadId) : ensureLoaded(leadId), [ensureLoaded, refresh]);
  return { details: itemsByKey, loading: loadingByKey, ensureLoaded: ensureDetail };
}
