import type { PropsWithChildren } from 'react';
import type { InboxRepository } from '../../features/inbox/contracts';
import { InboxListCacheProvider } from './InboxListCacheContext';
import { InboxDetailCacheProvider } from './InboxDetailCacheContext';

export function InboxCacheProviders({ repository, children }: PropsWithChildren<{ repository: InboxRepository }>) {
  return (
    <InboxListCacheProvider repository={repository}>
      <InboxDetailCacheProvider repository={repository}>
        {children}
      </InboxDetailCacheProvider>
    </InboxListCacheProvider>
  );
}
