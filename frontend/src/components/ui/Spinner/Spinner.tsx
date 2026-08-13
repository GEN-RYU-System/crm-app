import type { HTMLAttributes } from 'react';
import './Spinner.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';

type SpinnerProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  size?: SpinnerSize;
};

export function Spinner({ size = 'md', className = '', 'aria-label': ariaLabel = '読み込み中', ...props }: SpinnerProps) {
  return <span {...props} className={`ui-spinner ui-spinner--${size} ${className}`.trim()} role="status" aria-label={ariaLabel} />;
}
