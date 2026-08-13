export type NavigationItem = { id: 'dashboard' | 'components'; label: string; hash: string; icon: string; order: number; state: 'available' };

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { id: 'dashboard', label: 'ダッシュボード', hash: '/dashboard', icon: '▦', order: 1, state: 'available' },
  { id: 'components', label: '金型カタログ', hash: '/components', icon: '◇', order: 2, state: 'available' }
];

export const NAVIGATION_BY_ID = Object.fromEntries(NAVIGATION_ITEMS.map((item) => [item.id, item])) as Record<NavigationItem['id'], NavigationItem>;
