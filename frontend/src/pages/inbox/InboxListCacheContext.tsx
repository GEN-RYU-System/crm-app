import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY, type SingleKey } from '../../app/createListCache';
import type { InboxConversationDto, InboxRepository } from '../../features/inbox/contracts';
const { Provider, useCache } = createListCache<InboxConversationDto>({ name: 'inbox list' });
export function InboxListCacheProvider({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) { const fetcher = useCallback((_: SingleKey) => repository.listConversations(), [repository]); return <Provider fetcher={fetcher}>{children}</Provider>; }
export function useInboxListCache() { const { itemsByKey, errorByKey, loadingByKey, ensureLoaded, refresh } = useCache(); return { conversations: itemsByKey[SINGLE_KEY], error: errorByKey[SINGLE_KEY], loading: loadingByKey[SINGLE_KEY] ?? false, ensureLoaded: useCallback(() => ensureLoaded(), [ensureLoaded]), refresh: useCallback(() => refresh(), [refresh]) }; }
