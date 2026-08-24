import { useEffect, useMemo, useState } from 'react';
import { CRM_SEARCH_ICON } from '../../app/icons';
import { Badge, Button, ConversationWorkspace, EmptyState, PageHeader, Select, Skeleton, TabBar, Tabs, TextField, Textarea } from '../../components/ui';
import { inboxCopy } from '../../content/ja';
import type { InboxPlatform, InboxRepository, InboxStatus } from '../../features/inbox/contracts';
import { INBOX_KARTE_TABS, INBOX_PLATFORM_OPTIONS, INBOX_STATUS_TABS } from './inboxConfig';
import './InboxPreviewPage.css';
import { useInboxListCache } from './InboxListCacheContext';
import { useInboxDetailCache } from './InboxDetailCacheContext';

export function InboxPreviewPage({ repository: _repository }: { repository: InboxRepository }) {
  const [status, setStatus] = useState<InboxStatus>('all');
  const [platform, setPlatform] = useState<InboxPlatform>('all');
  const [query, setQuery] = useState('');
  const { conversations, error: listError, ensureLoaded } = useInboxListCache();
  const [selectedId, setSelectedId] = useState('');
  const { details, loading, ensureLoaded: ensureDetail } = useInboxDetailCache();
  const [karteTab, setKarteTab] = useState('customer');
  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);
  useEffect(() => { if (conversations?.length && !selectedId) setSelectedId(conversations[0].id); }, [conversations, selectedId]);
  useEffect(() => { if (conversations) void Promise.all(conversations.slice(0, 5).map((row) => ensureDetail(row.id))); }, [conversations, ensureDetail]);

  useEffect(() => {
    if (!selectedId) return;
    void ensureDetail(selectedId, true);
  }, [ensureDetail, selectedId]);

  const filtered = useMemo(() => (conversations ?? []).filter((conv) =>
    (status === 'all' || conv.status === status) &&
    (platform === 'all' || conv.platform === platform) &&
    `${conv.customerName} ${conv.summary}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [conversations, platform, query, status]);

  const effectiveConv = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;
  const detail = effectiveConv ? details[effectiveConv.id]?.[0] ?? null : null;
  const detailLoading = effectiveConv ? (loading[effectiveConv.id] ?? false) && detail === null : false;

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
            conversations === null && !listError
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
                  {detail.messages.map((message) => (
                    <article className={`inbox-preview__message inbox-preview__message--${message.sender}`} key={message.id}>
                      <p>{message.body}</p>
                      <time>{message.sentAt}</time>
                    </article>
                  ))}
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
