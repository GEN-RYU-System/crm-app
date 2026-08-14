import type { CRM_NAV_ICONS } from './icons';
import { navigationCopy } from '../content/ja';

export type NavigationPermission = 'lead_view';
export type NavigationPermissions = Partial<Record<NavigationPermission, boolean>>;
export type NavigationItem = { id: 'dashboard' | 'components' | 'leads'; label: string; hash: string; icon: keyof typeof CRM_NAV_ICONS; order: number; state: 'available'; requiredPermission?: NavigationPermission };

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { id: 'dashboard', label: navigationCopy.dashboard, hash: '/dashboard', icon: 'dashboard', order: 1, state: 'available' },
  { id: 'leads', label: navigationCopy.leads, hash: '/leads', icon: 'leads', order: 2, state: 'available', requiredPermission: 'lead_view' },
  { id: 'components', label: navigationCopy.components, hash: '/components', icon: 'components', order: 3, state: 'available' }
];

export const NAVIGATION_BY_ID = Object.fromEntries(NAVIGATION_ITEMS.map((item) => [item.id, item])) as Record<NavigationItem['id'], NavigationItem>;

/** Mirrors the existing SPA's menu-level permission check and defaults to deny. */
export function canAccessNavigationItem(item: NavigationItem, permissions: NavigationPermissions | null): boolean {
  return item.requiredPermission == null || permissions?.[item.requiredPermission] === true;
}

export function visibleNavigationItems(permissions: NavigationPermissions | null): readonly NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => canAccessNavigationItem(item, permissions));
}
