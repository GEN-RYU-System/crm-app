import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { InboxConversationDto, InboxRepository } from '../../features/inbox/contracts';

const { Provider, useCache } = createListCache<InboxConversationDto>({ name: 'inbox conversation list' });

export function InboxConversationListCacheProvider({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) {
  const fetcher = useCallback((_: SingleKey, forceRefresh: boolean) => repository.listConversations(forceRefresh), [repository]);
  return <Provider fetcher={fetcher}>{children}</Provider>;
}

export function useInboxConversationListCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  return {
    conversations: itemsByKey[SINGLE_KEY],
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: useCallback(() => ensureLoaded(), [ensureLoaded]),
    refresh: useCallback(() => refresh(), [refresh]),
    retry: useCallback(() => retry(), [retry]),
  };
}
