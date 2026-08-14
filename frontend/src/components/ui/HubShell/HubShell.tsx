import type { PropsWithChildren, ReactNode } from 'react';
import './HubShell.css';

export type HubShellProps = PropsWithChildren<{
  navigation: ReactNode;
  navigationLabel: string;
  className?: string;
}>;

export function HubShell({ navigation, navigationLabel, children, className = '' }: HubShellProps) {
  return <div className={`ui-hub-shell ${className}`.trim()}><aside className="ui-hub-shell__navigation" aria-label={navigationLabel}>{navigation}</aside><section className="ui-hub-shell__content">{children}</section></div>;
}
