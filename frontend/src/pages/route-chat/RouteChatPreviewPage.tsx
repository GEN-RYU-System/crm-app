import { useMemo, useState } from 'react';
import { Badge, Button, ConversationWorkspace, PageHeader, Tabs, Textarea, TextField } from '../../components/ui';
import { routeChatCopy } from '../../content/ja';
import { getRouteChatPreviewModel } from '../../features/route-chat/previewAdapter';
import { ROUTE_CHAT_DETAIL_TABS, type RouteChatDetailTab } from './routeChatConfig';
import './RouteChatPreviewPage.css';

export function RouteChatPreviewPage() {
  const model = useMemo(() => getRouteChatPreviewModel(), []);
  const [query, setQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(model.customers[0].id);
  const [detailTab, setDetailTab] = useState<RouteChatDetailTab>('opportunity');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const customers = model.customers.filter((customer) => `${customer.name} ${customer.route}`.toLocaleLowerCase().includes(normalizedQuery));
  const selectedCustomer = model.customers.find((customer) => customer.id === selectedCustomerId) ?? model.customers[0];
  const messages = model.messagesByCustomer[selectedCustomer.id] ?? [];
  const details = model.detailsByCustomer[selectedCustomer.id];
  const detailFields = detailTab === 'opportunity'
    ? [[routeChatCopy.fields.nextAction, details.nextAction], [routeChatCopy.fields.responseSpeed, details.responseSpeed], [routeChatCopy.fields.temperature, details.temperature], [routeChatCopy.fields.opportunityNote, details.opportunityNote]] as const
    : detailTab === 'customer'
      ? [[routeChatCopy.fields.customerCategory, details.customerCategory], [routeChatCopy.fields.responseSpeed, details.responseSpeed]] as const
      : [[routeChatCopy.fields.contactChannel, details.contactChannel], [routeChatCopy.fields.nextAction, details.nextAction]] as const;

  return <>
    <PageHeader eyebrow={routeChatCopy.eyebrow} title={routeChatCopy.title} subtitle={routeChatCopy.subtitle} action={<div className="route-chat-preview__actions"><Badge variant="info">{routeChatCopy.previewBadge}</Badge><Button disabled>{routeChatCopy.newLead}</Button></div>} />
    <ConversationWorkspace
      listLabel={routeChatCopy.customerList}
      listHeader={<TextField value={query} onChange={(event) => setQuery(event.target.value)} aria-label={routeChatCopy.searchLabel} placeholder={routeChatCopy.searchPlaceholder} fullWidth />}
      list={customers.length === 0 ? <p className="route-chat-preview__empty">{routeChatCopy.noCustomers}</p> : <div className="route-chat-preview__customer-list">{customers.map((customer) => <button key={customer.id} type="button" className={`route-chat-preview__customer${customer.id === selectedCustomer.id ? ' route-chat-preview__customer--active' : ''}`} onClick={() => setSelectedCustomerId(customer.id)}><span className="route-chat-preview__customer-heading"><strong>{customer.name}</strong><time>{customer.updatedAt}</time></span><span>{customer.route}</span><small>{customer.summary}</small></button>)}</div>}
      conversationLabel={routeChatCopy.conversation}
      conversationHeader={<div className="route-chat-preview__conversation-heading"><strong>{selectedCustomer.name}</strong><span>{selectedCustomer.route}</span></div>}
      conversation={<>{messages.map((message) => <article key={message.id} className={`route-chat-preview__message route-chat-preview__message--${message.sender}`}><p>{message.body}</p><time>{message.sentAt}</time></article>)}</>}
      composer={<div className="route-chat-preview__composer"><TextField value="" readOnly aria-label={routeChatCopy.composerPlaceholder} placeholder={routeChatCopy.composerPlaceholder} fullWidth /><Button disabled>{routeChatCopy.send}</Button></div>}
      detailsLabel={routeChatCopy.details}
      detailsHeader={<Tabs items={ROUTE_CHAT_DETAIL_TABS} activeKey={detailTab} onChange={setDetailTab} size="sm" aria-label={routeChatCopy.detailTabsLabel} />}
      details={<div className="route-chat-preview__details-fields">{detailFields.map(([label, value], index) => index === detailFields.length - 1 && detailTab === 'opportunity' ? <Textarea key={label} label={label} value={value} readOnly fullWidth /> : <TextField key={label} label={label} value={value} readOnly fullWidth />)}</div>}
    />
  </>;
}
