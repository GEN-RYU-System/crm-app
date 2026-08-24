import { useEffect, useMemo, useRef, useState } from 'react';
import { CRM_SEARCH_ICON } from '../../app/icons';
import { Badge, Button, ConversationWorkspace, EmptyState, PageHeader, Select, Skeleton, TabBar, Tabs, TextField, Textarea } from '../../components/ui';
import { inboxCopy } from '../../content/ja';
import type { InboxConversationDetailDto, InboxConversationDto, InboxPlatform, InboxRepository, InboxStatus } from '../../features/inbox/contracts';
import { INBOX_KARTE_TABS, INBOX_PLATFORM_OPTIONS, INBOX_STATUS_TABS } from './inboxConfig';
import './InboxPreviewPage.css';

export function InboxPreviewPage({ repository }: { repository: InboxRepository }) {
  const [status, setStatus] = useState<InboxStatus>('all');
  const [platform, setPlatform] = useState<InboxPlatform>('all');
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<readonly InboxConversationDto[] | null>(null);
  const [listError, setListError] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<InboxConversationDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [karteTab, setKarteTab] = useState('customer');
  const detailCache = useRef<Map<string, InboxConversationDetailDto>>(new Map());

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const rows = await repository.listConversations();
        if (!active) return;
        setConversations(rows);
        if (rows.length > 0) setSelectedId(rows[0].id);
      } catch {
        if (active) setListError(true);
      }
    })();
    return () => { active = false; };
  }, [repository]);

  useEffect(() => {
    if (!selectedId) return;
    const cached = detailCache.current.get(selectedId);
    if (cached) { setSelectedDetail(cached); return; }
    let active = true;
    setDetailLoading(true);
    void (async () => {
      try {
        const detail = await repository.getConversation(selectedId);
        if (!active) return;
        if (detail) {
          detailCache.current.set(selectedId, detail);
          setSelectedDetail(detail);
        }
      } finally {
        if (active) setDetailLoading(false);
      }
    })();
    return () => { active = false; };
  }, [repository, selectedId]);

  const filtered = useMemo(() => (conversations ?? []).filter((conv) =>
    (status === 'all' || conv.status === status) &&
    (platform === 'all' || conv.platform === platform) &&
    `${conv.customerName} ${conv.summary}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [conversations, platform, query, status]);

  const effectiveConv = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;
  const detail = effectiveConv?.id === selectedDetail?.conversation.id ? selectedDetail : null;

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
