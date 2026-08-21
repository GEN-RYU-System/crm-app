import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { Spinner } from '../Spinner/Spinner';
import './Button.css';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';
type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; loading?: boolean; loadingText?: string; iconOnly?: boolean };
export function Button({ variant = 'primary', size = 'md', fullWidth = false, loading = false, loadingText, iconOnly = false, children, disabled, className = '', 'aria-label': ariaLabel, ...props }: Props) { return <button className={`ui-button ui-button--${variant} ui-button--${size} ${fullWidth ? 'ui-button--full' : ''} ${loading ? 'ui-button--loading' : ''} ${iconOnly ? 'ui-button--icon-only' : ''} ${className}`.trim()} disabled={disabled || loading} aria-busy={loading || undefined} aria-label={ariaLabel} {...props}>{loading && <Spinner size="sm" aria-hidden="true" />}{loading ? (loadingText ?? children) : children}</button>; }
