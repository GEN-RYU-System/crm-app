import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import './Button.css';
export type ButtonVariant = 'primary' | 'secondary' | 'danger';
type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & { variant?: ButtonVariant; loading?: boolean };
export function Button({ variant = 'primary', loading = false, children, disabled, className = '', ...props }: Props) { return <button className={`ui-button ui-button--${variant} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? '読み込み中…' : children}</button>; }
