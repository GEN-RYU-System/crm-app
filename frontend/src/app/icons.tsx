import type { ComponentType, SVGProps } from 'react';
import { Squares2X2Icon, SwatchIcon } from '@heroicons/react/24/outline';

export type CrmNavIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** React POC navigation icons. Pages must not import Heroicons directly. */
export const CRM_NAV_ICONS = {
  dashboard: Squares2X2Icon,
  components: SwatchIcon
} satisfies Record<string, CrmNavIcon>;
