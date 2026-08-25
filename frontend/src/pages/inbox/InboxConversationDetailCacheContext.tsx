import { useCallback, type PropsWithChildren } from 'react';
import { createListCache } from '../../app/createListCache';
import type { InboxConversationDetailDto, InboxRepository } from '../../features/inbox/contracts';

const { Provider: BaseProvider, useCache } = createListCache<InboxConversationDetailDto, string>({ name: 'inbox conversation details' });

export function InboxConversationDetailCacheProvider({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) {
  const fetcher = useCallback(async (conversationId: string) => {
    const detail = await repository.getConversation(conversationId);
    return detail === null ? [] : [detail];
  }, [repository]);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useInboxConversationDetailCache() {
  const { itemsByKey, errorByKey, loadingByKey, ensureLoaded, refresh, retry } = useCache();
  return {
    detailsByConversationId: itemsByKey,
    errorsByConversationId: errorByKey,
    loadingByConversationId: loadingByKey,
    ensureLoaded: useCallback((conversationId: string) => ensureLoaded(conversationId), [ensureLoaded]),
    refresh: useCallback(() => refresh(), [refresh]),
    retry: useCallback((conversationId: string) => retry(conversationId), [retry]),
  };
}
