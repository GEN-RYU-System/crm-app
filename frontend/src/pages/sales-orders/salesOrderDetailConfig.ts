import type { BadgeVariant } from '../../components/ui/Badge/Badge';

/** Purchase status key to badge variant. Falls back to neutral for unknown keys. */
export const PURCHASE_STATUS_BADGE_VARIANT: Readonly<Record<string, BadgeVariant>> = {
  NOT_ORDERED: 'neutral',
  ORDERED:     'warning',
  CONFIRMED:   'info',
  PAID:        'success',
} as const;
