import type { ReactNode } from 'react';
import './TwoColumnLayout.css';

type Props = {
  /** Content for the left column (main content area) */
  left: ReactNode;
  /** Content for the right column (sticky summary panel) */
  right: ReactNode;
};

export function TwoColumnLayout({ left, right }: Props) {
  return (
    <div className="two-column-layout">
      <div className="two-column-layout__left">{left}</div>
      <div className="two-column-layout__right">{right}</div>
    </div>
  );
}
