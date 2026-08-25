import { useCallback, useEffect, useMemo, useState } from 'react';
import { CRM_SEARCH_ICON } from '../../app/icons';
import { Badge, Button, ConversationWorkspace, EmptyState, PageHeader, Select, Skeleton, TabBar, Tabs, TextField, Textarea } from '../../components/ui';
import { inboxCopy } from '../../content/ja';
import type { InboxMessageDto, InboxPlatform, InboxRepository, InboxStatus } from '../../features/inbox/contracts';
import { INBOX_KARTE_TABS, INBOX_PLATFORM_OPTIONS, INBOX_STATUS_TABS } from './inboxConfig';
import { useInboxConversationListCache } from './InboxConversationListCacheContext';
import { useInboxConversationDetailCache } from './InboxConversationDetailCacheContext';
import './InboxPreviewPage.css';

export function InboxPreviewPage({ repository }: { repository: InboxRepository }) {
  const [status, setStatus] = useState<InboxStatus>('all');
  const [platform, setPlatform] = useState<InboxPlatform>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [karteTab, setKarteTab] = useState('customer');
  // extra messages loaded via "load more" (keyed by conversationId)
  const [extraMessages, setExtraMessages] = useState<Record<string, readonly InboxMessageDto[]>>({});
  const [extraHasMore, setExtraHasMore] = useState<Record<string, boolean>>({});
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);

  const { conversations, error: listError, ensureLoaded } = useInboxConversationListCache();
  const { detailsByConversationId, ensureLoaded: ensureDetailLoaded, prefetchBulk } = useInboxConversationDetailCache();

  // ── 1. Load list on mount ──
  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);

  // ── 2. Set initial selection ──
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;
    setSelectedId((current) => conversations.some((c) => c.id === current) ? current : conversations[0].id);
  }, [conversations]);

  // ── 3. Bulk hydration: normally fires from usePrefetch at startup;
  //    this is the fallback for direct inbox navigation before prefetch reaches this step ──
  useEffect(() => { void prefetchBulk(); }, [prefetchBulk]);

  // ── 4. On conversation select: ensure detail loaded; reset extra messages ──
  useEffect(() => {
    if (!selectedId) return;
    void ensureDetailLoaded(selectedId);
    setExtraMessages((prev) => (selectedId in prev ? prev : prev)); // keep existing extras
  }, [ensureDetailLoaded, selectedId]);

  const filtered = useMemo(() => (conversations ?? []).filter((conv) =>
    (status === 'all' || conv.status === status) &&
    (platform === 'all' || conv.platform === platform) &&
    `${conv.customerName} ${conv.summary}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [conversations, platform, query, status]);

  const effectiveConv = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;
  const detail = effectiveConv?.id === selectedId ? detailsByConversationId[selectedId]?.[0] ?? null : null;
  // Show skeleton until the fetch attempt for this id is complete (id present in cache).
  // Stale-while-revalidate: if data exists (detail !== null), no skeleton shown.
  const fetchDone = selectedId === '' || (selectedId in detailsByConversationId);
  const detailLoading = selectedId !== '' && !fetchDone;

  const baseMessages = detail?.messages ?? [];
  const extra = extraMessages[selectedId] ?? [];
  const allMessages = extra.length > 0 ? [...baseMessages, ...extra] : baseMessages;
  // Show "load more" if: initial bulk set hasMore AND we either haven't loaded extras yet,
  // OR the most recent chunk indicated there are still more messages
  const showLoadMore = !loadMoreLoading && (
    (detail?.hasMore === true && extra.length === 0) ||
    extraHasMore[selectedId] === true
  );

  const handleLoadMore = useCallback(async () => {
    if (!selectedId || loadMoreLoading) return;
    setLoadMoreLoading(true);
    try {
      const offset = baseMessages.length + (extraMessages[selectedId]?.length ?? 0);
      const { messages: more, hasMore } = await repository.getMoreMessages(selectedId, offset);
      setExtraMessages((prev) => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] ?? []), ...more],
      }));
      setExtraHasMore((prev) => ({ ...prev, [selectedId]: hasMore }));
    } finally {
      setLoadMoreLoading(false);
    }
  }, [baseMessages.length, extraMessages, loadMoreLoading, repository, selectedId]);

  const karteFields: [string, string][] = detail == null ? [] : karteTab === 'customer'
    ? [[inboxCopy.fields.customerName, detail.karte.customerName], [inboxCopy.fields.platform, detail.karte.platform]]
    : karteTab === 'company'
    ? [[inboxCopy.fields.company, detail.karte.company], [inboxCopy.fields.status, detail.karte.status]]
    : [[inboxCopy.fields.nextAction, detail.karte.nextAction], [inboxCopy.fields.note, detail.karte.note]];

  return (
    <>
      <PageHeader eyebrow={inboxCopy.eyebrow} title={inboxCopy.title} subtitle={inboxCopy.subtitle} />
      <section className="inbox-preview">
        <div className="inbox-preview__tab-row">
          <TabBar items={INBOX_STATUS_TABS} activeKey={status} onChange={setStatus} aria-label={inboxCopy.statusTabsLabel} />
          <Select aria-label={inboxCopy.platformsLabel} options={INBOX_PLATFORM_OPTIONS as { value: string; label: string }[]} value={platform} onChange={(event) => setPlatform(event.target.value as InboxPlatform)} />
        </div>
        <ConversationWorkspace
          className="inbox-preview__workspace"
          listLabel={inboxCopy.listLabel}
          listHeader={<TextField aria-label={inboxCopy.searchLabel} placeholder={inboxCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} fullWidth startIcon={<CRM_SEARCH_ICON aria-hidden="true" />} />}
          list={
            conversations === undefined && listError === undefined
              ? <Skeleton variant="list" rows={4} label={inboxCopy.loading} />
              : filtered.length === 0
              ? <EmptyState title={inboxCopy.noConversations} description={inboxCopy.noConversationsDescription} />
              : <div className="inbox-preview__list">
                  {filtered.map((conv) => (
                    <button
                      className={`inbox-preview__row${conv.id === effectiveConv?.id ? ' inbox-preview__row--active' : ''}`}
                      key={conv.id}
                      onClick={() => setSelectedId(conv.id)}
                      type="button"
                    >
                      <strong>{conv.customerName}</strong>
                      <span>{conv.summary}</span>
                      <small>{conv.platform} · {conv.updatedAt}</small>
                    </button>
                  ))}
                </div>
          }
          conversationLabel={inboxCopy.conversationLabel}
          conversationHeader={effectiveConv && (
            <div className="inbox-preview__conversation-header">
              <strong>{effectiveConv.customerName}</strong>
              <Badge variant="info" size="sm">{effectiveConv.platform}</Badge>
            </div>
          )}
          conversation={
            detailLoading
              ? <Skeleton variant="list" rows={3} label={inboxCopy.loading} />
              : detail
              ? <div className="inbox-preview__messages">
                  {allMessages.map((message) => (
                    <article className={`inbox-preview__message inbox-preview__message--${message.sender}`} key={message.id}>
                      <p>{message.body}</p>
                      <time>{message.sentAt}</time>
                    </article>
                  ))}
                  {showLoadMore && (
                    <div className="inbox-preview__load-more">
                      <Button variant="ghost" size="sm" onClick={() => { void handleLoadMore(); }}>
                        {inboxCopy.loadMoreMessages}
                      </Button>
                    </div>
                  )}
                  {loadMoreLoading && (
                    <div className="inbox-preview__load-more">
                      <Skeleton variant="list" rows={2} label={inboxCopy.loadMoreLoading} />
                    </div>
                  )}
                </div>
              : <EmptyState title={inboxCopy.noConversations} description={inboxCopy.noConversationsDescription} />
          }
          composer={<div className="inbox-preview__composer"><TextField aria-label={inboxCopy.composerPlaceholder} placeholder={inboxCopy.composerPlaceholder} readOnly fullWidth value="" /><Button disabled>{inboxCopy.send}</Button></div>}
          detailsLabel={inboxCopy.detailsLabel}
          detailsHeader={<Tabs items={INBOX_KARTE_TABS} activeKey={karteTab} onChange={setKarteTab} size="sm" aria-label={inboxCopy.detailTabsLabel} />}
          details={
            <div className="inbox-preview__karte">
              {karteFields.map(([label, value]) =>
                label === inboxCopy.fields.note
                  ? <Textarea key={label} label={label} readOnly value={value} />
                  : <TextField key={label} label={label} readOnly value={value} />
              )}
            </div>
          }
        />
      </section>
    </>
  );
}
