import { createContext, useCallback, useContext, useRef, type PropsWithChildren } from 'react';
import { createListCache } from '../../app/createListCache';
import type { InboxConversationDetailDto, InboxRepository } from '../../features/inbox/contracts';

const { Provider: BaseProvider, useCache } = createListCache<InboxConversationDetailDto, string>({ name: 'inbox conversation details' });

// Exposes prefetchBulk to any consumer inside the provider tree
type BulkCtx = { prefetchBulk: () => Promise<void> };
const BulkHydrationContext = createContext<BulkCtx | null>(null);

// Lives inside BaseProvider so it can access seed; owns the idempotency ref
function BulkHydrationBridge({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) {
  const { seed } = useCache();
  const loadedRef = useRef(false);

  const prefetchBulk = useCallback(async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const bulk = await repository.getBulkInitialLoad();
      for (const [id, detail] of Object.entries(bulk.detailsByConversationId) as [string, InboxConversationDetailDto][]) {
        seed(id, [detail]);
      }
    } catch {
      // bulk hydration failure is non-fatal; individual loads remain available
    }
  }, [repository, seed]);

  return <BulkHydrationContext.Provider value={{ prefetchBulk }}>{children}</BulkHydrationContext.Provider>;
}

export function InboxConversationDetailCacheProvider({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) {
  const fetcher = useCallback(async (conversationId: string) => {
    const detail = await repository.getConversation(conversationId);
    return detail === null ? [] : [detail];
  }, [repository]);
  return (
    <BaseProvider fetcher={fetcher}>
      <BulkHydrationBridge repository={repository}>
        {children}
      </BulkHydrationBridge>
    </BaseProvider>
  );
}

export function useInboxConversationDetailCache() {
  const { itemsByKey, errorByKey, loadingByKey, ensureLoaded, refresh, retry, seed } = useCache();
  const bulkCtx = useContext(BulkHydrationContext);
  return {
    detailsByConversationId: itemsByKey,
    errorsByConversationId: errorByKey,
    loadingByConversationId: loadingByKey,
    ensureLoaded: useCallback((conversationId: string) => ensureLoaded(conversationId), [ensureLoaded]),
    refresh: useCallback(() => refresh(), [refresh]),
    retry: useCallback((conversationId: string) => retry(conversationId), [retry]),
    seed: useCallback((conversationId: string, detail: InboxConversationDetailDto) => seed(conversationId, [detail]), [seed]),
    prefetchBulk: bulkCtx?.prefetchBulk ?? (() => Promise.resolve()),
  };
}
