import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { InboxConversationDto, InboxRepository } from '../../features/inbox/contracts';

const { Provider, useCache } = createListCache<InboxConversationDto>({ name: 'inbox list' });

export function InboxListCacheProvider({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) {
  const fetcher = useCallback((_: SingleKey) => repository.listConversations(), [repository]);
  return <Provider fetcher={fetcher}>{children}</Provider>;
}

export function useInboxListCache() {
  const cache = useCache();
  const ensureLoaded = useCallback(() => cache.ensureLoaded(), [cache]);
  const refresh = useCallback(() => cache.refresh(), [cache]);
  return { conversations: cache.itemsByKey[SINGLE_KEY], error: cache.errorByKey[SINGLE_KEY], loading: cache.loadingByKey[SINGLE_KEY] ?? false, ensureLoaded, refresh };
}
