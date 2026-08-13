import './Skeleton.css';
export type SkeletonVariant = 'text' | 'table' | 'list' | 'card';
export type SkeletonProps = { variant?: SkeletonVariant; rows?: number };
export function Skeleton({ variant = 'text', rows = 3 }: SkeletonProps) { const bars = Array.from({ length: rows }, (_, index) => <span key={index} className="ui-skeleton__bar" />); if (variant === 'text') return <span className="ui-skeleton ui-skeleton--text" role="status" aria-label="読み込み中" />; if (variant === 'table') return <div className="ui-skeleton__table" role="status" aria-label="読み込み中">{bars}</div>; if (variant === 'list') return <div className="ui-skeleton__list" role="status" aria-label="読み込み中">{bars}</div>; return <div className="ui-skeleton__card" role="status" aria-label="読み込み中">{bars}</div>; }
