import type { ComponentType, SVGProps } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ArrowsUpDownIcon, Squares2X2Icon, SwatchIcon, UsersIcon } from '@heroicons/react/24/outline';

export type CrmNavIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** React POC navigation icons. Pages must not import Heroicons directly. */
export const CRM_NAV_ICONS = {
  dashboard: Squares2X2Icon,
  components: SwatchIcon,
  leads: UsersIcon
} satisfies Record<string, CrmNavIcon>;

/** React POC sort icons. Pages must not import Heroicons directly. */
export const CRM_SORT_ICONS = {
  none: ArrowsUpDownIcon,
  ascending: ArrowUpIcon,
  descending: ArrowDownIcon
} satisfies Record<'none' | 'ascending' | 'descending', CrmNavIcon>;
