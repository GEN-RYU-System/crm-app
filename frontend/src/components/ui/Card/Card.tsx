import type { HTMLAttributes, PropsWithChildren } from 'react';
import './Card.css';
export type CardVariant = 'default' | 'outlined';
type Props = PropsWithChildren<HTMLAttributes<HTMLElement>> & { variant?: CardVariant };
export function Card({ variant = 'default', children, className = '', ...props }: Props) { return <section className={`ui-card ui-card--${variant} ${className}`.trim()} {...props}>{children}</section>; }
