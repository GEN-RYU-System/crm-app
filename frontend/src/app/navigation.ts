import type { CRM_NAV_ICONS } from './icons';
import { dataManagementCopy, navigationCopy } from '../content/ja';

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
  | 'customers'
  | 'inbox'
  | 'inventory'
  | 'quotes'
  | 'quoteHistory'
  | 'invoices'
  | 'reports'
  | 'faq'
  | 'deals'
  | 'staff'
  | 'staffManagement'
  | 'roles'
  | 'compensationSettings'
  | 'compensationRecords'
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

export const STAFF_MANAGEMENT_ROOT = '/staff';

export const STAFF_MANAGEMENT_ITEMS: readonly NavigationItem[] = [
  { id: 'staff', label: navigationCopy.staff, hash: STAFF_MANAGEMENT_ROOT, icon: 'staff', order: 1, state: 'planned', requiredPermission: 'staff_manage' },
  { id: 'roles', label: navigationCopy.roles, hash: '/roles', icon: 'permissions', order: 2, state: 'planned', requiredPermission: 'staff_manage' },
  { id: 'compensationSettings', label: navigationCopy.compensationSettings, hash: '/compensation-settings', icon: 'settings', order: 3, state: 'planned', requiredPermission: 'staff_manage' },
  { id: 'compensationRecords', label: navigationCopy.compensationRecords, hash: '/compensation-records', icon: 'history', order: 4, state: 'planned', requiredPermission: 'staff_manage' }
];

/**
 * The hub's entry is the already-available lead route. This preserves the
 * established #/leads, #/leads/new, and #/leads/:leadId URLs while the
 * surrounding route renders the data-management secondary navigation.
 */
export const DATA_MANAGEMENT_ROOT = '/leads';

export const DATA_MANAGEMENT_ITEMS: readonly NavigationItem[] = [
  { id: 'leads', label: dataManagementCopy.leads, hash: DATA_MANAGEMENT_ROOT, icon: 'leads', order: 1, state: 'available', requiredPermission: 'lead_view' },
  { id: 'customers', label: dataManagementCopy.customers, hash: '/customers', icon: 'customers', order: 2, state: 'preview', requiredPermission: 'lead_view' }
];

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  { id: 'overview', label: navigationCopy.groups.overview, order: 1, items: [
    { id: 'dashboard', label: navigationCopy.dashboard, hash: '/dashboard', icon: 'dashboard', order: 1, state: 'available' }
  ] },
  { id: 'leads', label: navigationCopy.groups.leads, order: 2, items: [
    { id: 'inbox', label: navigationCopy.inbox, hash: '/inbox', icon: 'chat', order: 2, state: 'preview', requiredPermission: 'lead_view' }
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
    { id: 'staffManagement', label: navigationCopy.staffManagement, hash: STAFF_MANAGEMENT_ROOT, icon: 'staff', order: 2, state: 'planned', requiredPermission: 'staff_manage', children: STAFF_MANAGEMENT_ITEMS },
    { id: 'permissions', label: navigationCopy.permissions, hash: '/permissions', icon: 'permissions', order: 3, state: 'planned', requiredPermission: 'admin_access' },
    { id: 'dataManagement', label: navigationCopy.dataManagement, hash: DATA_MANAGEMENT_ROOT, icon: 'database', order: 4, state: 'available', requiredPermission: 'lead_view', children: DATA_MANAGEMENT_ITEMS }
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

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  ...NAVIGATION_GROUPS.flatMap((group) => group.items),
  ...NAVIGATION_GROUPS.flatMap((group) => group.items.flatMap((item) => item.children ?? []))
];
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
  return NAVIGATION_ITEMS.filter((item) => canAccessNavigationItem(item, permissions));
}

export function visibleDataManagementItems(permissions: NavigationPermissions | null): readonly NavigationItem[] {
  return NAVIGATION_BY_ID.dataManagement.children?.filter((item) => canAccessNavigationItem(item, permissions)) ?? [];
}

export function visibleNavigationGroups(permissions: NavigationPermissions | null): readonly NavigationGroup[] {
  return NAVIGATION_GROUPS.map((group) => ({ ...group, items: group.items
    .filter((item) => canAccessNavigationItem(item, permissions))
    .map((item) => item.children == null ? item : ({ ...item, children: item.children.filter((child) => canAccessNavigationItem(child, permissions)) }))
    .filter((item) => item.children == null || item.children.length > 0) }))
    .filter((group) => group.items.length > 0);
}

export function navigationItemMatchesPath(item: NavigationItem, pathname: string): boolean {
  return pathname === item.hash || pathname.startsWith(`${item.hash}/`) || item.children?.some((child) => navigationItemMatchesPath(child, pathname)) === true;
}
