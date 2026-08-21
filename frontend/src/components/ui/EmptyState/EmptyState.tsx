import type { ReactNode } from 'react';
import './EmptyState.css';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return <section className="ui-empty-state"><h2 className="ui-empty-state__title">{title}</h2>{description && <p className="ui-empty-state__description">{description}</p>}{action && <div className="ui-empty-state__action">{action}</div>}</section>;
}
