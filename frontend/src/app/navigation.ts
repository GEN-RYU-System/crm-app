import type { CRM_NAV_ICONS } from './icons';

export type NavigationItem = { id: 'dashboard' | 'components'; label: string; hash: string; icon: keyof typeof CRM_NAV_ICONS; order: number; state: 'available' };

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { id: 'dashboard', label: 'ダッシュボード', hash: '/dashboard', icon: 'dashboard', order: 1, state: 'available' },
  { id: 'components', label: '金型カタログ', hash: '/components', icon: 'components', order: 2, state: 'available' }
];

export const NAVIGATION_BY_ID = Object.fromEntries(NAVIGATION_ITEMS.map((item) => [item.id, item])) as Record<NavigationItem['id'], NavigationItem>;
