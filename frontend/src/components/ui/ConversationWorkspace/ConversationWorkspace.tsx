import type { ReactNode } from 'react';
import './ConversationWorkspace.css';

export type ConversationWorkspaceProps = {
  listLabel: string;
  listHeader?: ReactNode;
  list: ReactNode;
  conversationLabel: string;
  conversationHeader?: ReactNode;
  conversation: ReactNode;
  composer?: ReactNode;
  detailsLabel: string;
  detailsHeader?: ReactNode;
  details: ReactNode;
  className?: string;
};

export function ConversationWorkspace({ listLabel, listHeader, list, conversationLabel, conversationHeader, conversation, composer, detailsLabel, detailsHeader, details, className = '' }: ConversationWorkspaceProps) {
  return <section className={`ui-conversation-workspace ${className}`.trim()}>
    <aside className="ui-conversation-workspace__panel ui-conversation-workspace__list" aria-label={listLabel}>
      {listHeader && <div className="ui-conversation-workspace__panel-header">{listHeader}</div>}
      <div className="ui-conversation-workspace__panel-body">{list}</div>
    </aside>
    <section className="ui-conversation-workspace__panel ui-conversation-workspace__conversation" aria-label={conversationLabel}>
      {conversationHeader && <div className="ui-conversation-workspace__panel-header">{conversationHeader}</div>}
      <div className="ui-conversation-workspace__messages">{conversation}</div>
      {composer && <div className="ui-conversation-workspace__composer">{composer}</div>}
    </section>
    <aside className="ui-conversation-workspace__panel ui-conversation-workspace__details" aria-label={detailsLabel}>
      {detailsHeader && <div className="ui-conversation-workspace__panel-header">{detailsHeader}</div>}
      <div className="ui-conversation-workspace__panel-body">{details}</div>
    </aside>
  </section>;
}
