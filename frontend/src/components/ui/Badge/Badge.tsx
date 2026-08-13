import type { HTMLAttributes, ReactNode } from 'react';
import './Badge.css';
export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'; export type BadgeAppearance = 'soft' | 'solid'; export type BadgeSize = 'sm' | 'md';
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant; appearance?: BadgeAppearance; size?: BadgeSize; dot?: boolean; icon?: ReactNode; children: ReactNode };
export function Badge({ variant = 'neutral', appearance = 'soft', size = 'md', dot = false, icon, children, className = '', ...props }: BadgeProps) { return <span {...props} className={`ui-badge ui-badge--${variant} ui-badge--${appearance} ui-badge--${size} ${className}`.trim()}>{dot && <span className="ui-badge__dot" aria-hidden="true" />}{icon != null && <span className="ui-badge__icon" aria-hidden="true">{icon}</span>}{children}</span>; }
