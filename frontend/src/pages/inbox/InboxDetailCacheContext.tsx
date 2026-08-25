import { useCallback, type PropsWithChildren } from 'react';
import { createListCache } from '../../app/createListCache';
import type { InboxConversationDetailDto, InboxRepository } from '../../features/inbox/contracts';
const { Provider, useCache } = createListCache<InboxConversationDetailDto, string>({ name: 'inbox detail' });
export function InboxDetailCacheProvider({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) { const fetcher = useCallback(async (id: string) => { const detail = await repository.getConversation(id); return detail ? [detail] : []; }, [repository]); return <Provider fetcher={fetcher}>{children}</Provider>; }
export function useInboxDetailCache() { const { itemsByKey, loadingByKey, ensureLoaded, refresh } = useCache(); return { details: itemsByKey, loading: loadingByKey, load: useCallback((id: string, revalidate = false) => revalidate ? refresh(id) : ensureLoaded(id), [ensureLoaded, refresh]) }; }
