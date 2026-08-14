import type { CRM_NAV_ICONS } from './icons';
import { navigationCopy } from '../content/ja';

export type NavigationPermission =
  | 'lead_view'
  | 'lead_add'
  | 'lead_edit'
  | 'dashboard_view'
  | 'deal_view_all'
  | 'deal_view_own'
  | 'admin_access'
  | 'staff_manage'
  | 'settings';
export type NavigationPermissions = Partial<Record<NavigationPermission, boolean>>;
export type NavigationItemId =
  | 'dashboard'
  | 'leads'
  | 'leadsChat'
  | 'newChat'
  | 'routeChat'
  | 'archiveChat'
  | 'inventory'
  | 'quotes'
  | 'quoteHistory'
  | 'invoices'
  | 'reports'
  | 'faq'
  | 'deals'
  | 'staff'
  | 'permissions'
  | 'dataManagement'
  | 'preferences'
  | 'knowledge'
  | 'translationPrompts'
  | 'templates'
  | 'components';
export type NavigationItemState = 'available' | 'preview' | 'planned';
export type NavigationItem = {
  id: NavigationItemId;
  label: string;
  hash: string;
  icon: keyof typeof CRM_NAV_ICONS;
  order: number;
  state: NavigationItemState;
  requiredPermission?: NavigationPermission;
  anyPermissions?: readonly NavigationPermission[];
  children?: readonly NavigationItem[];
};
export type NavigationGroup = {
  id: 'overview' | 'leads' | 'sales' | 'support' | 'management' | 'tools' | 'development';
  label: string;
  order: number;
  items: readonly NavigationItem[];
};

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  { id: 'overview', label: navigationCopy.groups.overview, order: 1, items: [
    { id: 'dashboard', label: navigationCopy.dashboard, hash: '/dashboard', icon: 'dashboard', order: 1, state: 'available' }
  ] },
  { id: 'leads', label: navigationCopy.groups.leads, order: 2, items: [
    { id: 'leadsChat', label: navigationCopy.leadsChat, hash: '/leads-chat', icon: 'chat', order: 2, state: 'planned', requiredPermission: 'lead_view' },
    { id: 'newChat', label: navigationCopy.newChat, hash: '/new-chat', icon: 'newLead', order: 3, state: 'planned', requiredPermission: 'lead_view' },
    { id: 'routeChat', label: navigationCopy.routeChat, hash: '/route-chat', icon: 'route', order: 4, state: 'preview', requiredPermission: 'lead_view' },
    { id: 'archiveChat', label: navigationCopy.archiveChat, hash: '/archive-chat', icon: 'archive', order: 5, state: 'planned', requiredPermission: 'lead_view' }
  ] },
  { id: 'sales', label: navigationCopy.groups.sales, order: 3, items: [
    { id: 'inventory', label: navigationCopy.inventory, hash: '/inventory', icon: 'inventory', order: 1, state: 'planned', anyPermissions: ['deal_view_all', 'deal_view_own'] },
    { id: 'quotes', label: navigationCopy.quotes, hash: '/quotes', icon: 'document', order: 2, state: 'planned', anyPermissions: ['deal_view_all', 'deal_view_own'] },
    { id: 'quoteHistory', label: navigationCopy.quoteHistory, hash: '/quote-history', icon: 'history', order: 3, state: 'planned', anyPermissions: ['deal_view_all', 'deal_view_own'] },
    { id: 'invoices', label: navigationCopy.invoices, hash: '/invoices', icon: 'invoice', order: 4, state: 'planned', anyPermissions: ['deal_view_all', 'deal_view_own'] },
    { id: 'reports', label: navigationCopy.reports, hash: '/reports', icon: 'reports', order: 5, state: 'planned', anyPermissions: ['deal_view_all', 'deal_view_own'] }
  ] },
  { id: 'support', label: navigationCopy.groups.support, order: 4, items: [
    { id: 'faq', label: navigationCopy.faq, hash: '/faq', icon: 'faq', order: 1, state: 'planned' }
  ] },
  { id: 'management', label: navigationCopy.groups.management, order: 5, items: [
    { id: 'deals', label: navigationCopy.deals, hash: '/deals', icon: 'deals', order: 1, state: 'planned', requiredPermission: 'deal_view_all' },
    { id: 'staff', label: navigationCopy.staff, hash: '/staff', icon: 'staff', order: 2, state: 'planned', requiredPermission: 'staff_manage' },
    { id: 'permissions', label: navigationCopy.permissions, hash: '/permissions', icon: 'permissions', order: 3, state: 'planned', requiredPermission: 'admin_access' },
    { id: 'dataManagement', label: navigationCopy.dataManagement, hash: '/data-management', icon: 'database', order: 4, state: 'available', children: [
      { id: 'leads', label: navigationCopy.leads, hash: '/leads', icon: 'leads', order: 1, state: 'available', requiredPermission: 'lead_view' }
    ] }
  ] },
  { id: 'tools', label: navigationCopy.groups.tools, order: 6, items: [
    { id: 'preferences', label: navigationCopy.preferences, hash: '/preferences', icon: 'settings', order: 1, state: 'planned' },
    { id: 'knowledge', label: navigationCopy.knowledge, hash: '/knowledge', icon: 'knowledge', order: 2, state: 'planned', anyPermissions: ['admin_access', 'staff_manage'] },
    { id: 'translationPrompts', label: navigationCopy.translationPrompts, hash: '/translation-prompts', icon: 'translation', order: 3, state: 'planned', anyPermissions: ['admin_access', 'staff_manage'] },
    { id: 'templates', label: navigationCopy.templates, hash: '/templates', icon: 'templates', order: 4, state: 'planned', requiredPermission: 'admin_access' }
  ] },
  { id: 'development', label: navigationCopy.groups.development, order: 7, items: [
    { id: 'components', label: navigationCopy.components, hash: '/components', icon: 'components', order: 1, state: 'available' }
  ] }
];

function flattenNavigationItems(items: readonly NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => [item, ...flattenNavigationItems(item.children ?? [])]);
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = NAVIGATION_GROUPS.flatMap((group) => flattenNavigationItems(group.items));
export const NAVIGATION_BY_ID = Object.fromEntries(NAVIGATION_ITEMS.map((item) => [item.id, item])) as Record<NavigationItemId, NavigationItem>;

/** Mirrors the existing SPA's menu-level permission checks and defaults to deny protected items. */
export function canAccessNavigationItem(item: NavigationItem, permissions: NavigationPermissions | null): boolean {
  if (item.requiredPermission != null && !hasNavigationPermission(permissions, item.requiredPermission)) return false;
  if (item.anyPermissions != null && !item.anyPermissions.some((permission) => hasNavigationPermission(permissions, permission))) return false;
  return true;
}

export function hasNavigationPermission(permissions: NavigationPermissions | null, permission: NavigationPermission): boolean {
  return permissions?.[permission] === true;
}

export function visibleNavigationItems(permissions: NavigationPermissions | null): readonly NavigationItem[] {
  return visibleNavigationGroups(permissions).flatMap((group) => flattenNavigationItems(group.items));
}

function visibleNavigationItem(item: NavigationItem, permissions: NavigationPermissions | null): NavigationItem | null {
  if (!canAccessNavigationItem(item, permissions)) return null;
  if (item.children == null) return item;
  const children = item.children.map((child) => visibleNavigationItem(child, permissions)).filter((child): child is NavigationItem => child != null);
  return children.length > 0 ? { ...item, children } : null;
}

export function visibleNavigationGroups(permissions: NavigationPermissions | null): readonly NavigationGroup[] {
  return NAVIGATION_GROUPS.map((group) => ({ ...group, items: group.items.map((item) => visibleNavigationItem(item, permissions)).filter((item): item is NavigationItem => item != null) }))
    .filter((group) => group.items.length > 0);
}
