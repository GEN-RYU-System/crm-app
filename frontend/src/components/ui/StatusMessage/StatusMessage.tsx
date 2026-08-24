import type { ReactNode } from 'react';
import './StatusMessage.css';
export type StatusMessageVariant = 'loading' | 'error' | 'success' | 'empty';
export function StatusMessage({ variant, children }: { variant: StatusMessageVariant; children: ReactNode }) { return <section className={`ui-status-message ui-status-message--${variant}`} role={variant === 'error' ? 'alert' : undefined} aria-live={variant === 'loading' ? 'polite' : undefined}>{children}</section>; }
