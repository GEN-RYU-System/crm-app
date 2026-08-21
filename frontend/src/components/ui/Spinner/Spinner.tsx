import type { HTMLAttributes } from 'react';
import './Spinner.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';

type SpinnerProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  size?: SpinnerSize;
};

export function Spinner({ size = 'md', className = '', 'aria-label': ariaLabel, ...props }: SpinnerProps) {
  return <span {...props} className={`ui-spinner ui-spinner--${size} ${className}`.trim()} role={ariaLabel ? "status" : undefined} aria-label={ariaLabel} />;
}
