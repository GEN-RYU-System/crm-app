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
  | 'staff'
  | 'staffManagement'
  | 'roles'
  | 'compensationSettings'
  | 'compensationRecords'
  | 'dataManagement'
  | 'quotes'
  | 'orders'
  | 'sales'
  | 'productMaster'
  | 'googleDrive'
  | 'discord'
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
  id: 'overview' | 'leads' | 'management' | 'development';
  label: string;
  order: number;
  items: readonly NavigationItem[];
};
export type DataManagementGroupDef = { title: string; items: readonly NavigationItem[] };

export const STAFF_MANAGEMENT_ROOT = '/staff';

export const STAFF_MANAGEMENT_ITEMS: readonly NavigationItem[] = [
  { id: 'staff', label: navigationCopy.staff, hash: STAFF_MANAGEMENT_ROOT, icon: 'staff', order: 1, state: 'preview', requiredPermission: 'staff_manage' },
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

const DATA_MGMT_SUB_ITEMS: readonly NavigationItem[] = [
  { id: 'leads', label: dataManagementCopy.leads, hash: DATA_MANAGEMENT_ROOT, icon: 'leads', order: 1, state: 'available', requiredPermission: 'lead_view' },
  { id: 'customers', label: dataManagementCopy.customers, hash: '/customers', icon: 'customers', order: 2, state: 'preview', requiredPermission: 'lead_view' },
  { id: 'quotes', label: dataManagementCopy.quotes, hash: '/quotes', icon: 'document', order: 3, state: 'preview', requiredPermission: 'lead_view' },
  { id: 'orders', label: dataManagementCopy.orders, hash: '/orders', icon: 'invoice', order: 4, state: 'preview', requiredPermission: 'lead_view' },
  { id: 'sales', label: dataManagementCopy.sales, hash: '/sales', icon: 'invoice', order: 5, state: 'planned', requiredPermission: 'lead_view' }
];

const PRODUCT_MGMT_SUB_ITEMS: readonly NavigationItem[] = [
  { id: 'inventory', label: dataManagementCopy.inventory, hash: '/inventory', icon: 'inventory', order: 1, state: 'preview', anyPermissions: ['deal_view_all', 'deal_view_own'] },
  { id: 'productMaster', label: dataManagementCopy.productMaster, hash: '/product-master', icon: 'inventory', order: 2, state: 'planned', requiredPermission: 'staff_manage' }
];

const EXTERNAL_LINK_SUB_ITEMS: readonly NavigationItem[] = [
  { id: 'googleDrive', label: dataManagementCopy.googleDrive, hash: '/google-drive', icon: 'document', order: 1, state: 'planned', requiredPermission: 'admin_access' },
  { id: 'discord', label: dataManagementCopy.discord, hash: '/discord', icon: 'chat', order: 2, state: 'planned', requiredPermission: 'admin_access' }
];

export const DATA_MANAGEMENT_ITEMS: readonly NavigationItem[] = [
  ...STAFF_MANAGEMENT_ITEMS,
  ...DATA_MGMT_SUB_ITEMS,
  ...PRODUCT_MGMT_SUB_ITEMS,
  ...EXTERNAL_LINK_SUB_ITEMS
];

export const DATA_MANAGEMENT_GROUP_DEFS: readonly DataManagementGroupDef[] = [
  { title: dataManagementCopy.groupStaffManagement, items: STAFF_MANAGEMENT_ITEMS },
  { title: dataManagementCopy.groupDataManagement, items: DATA_MGMT_SUB_ITEMS },
  { title: dataManagementCopy.groupProductManagement, items: PRODUCT_MGMT_SUB_ITEMS },
  { title: dataManagementCopy.groupExternalLinks, items: EXTERNAL_LINK_SUB_ITEMS }
];

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  { id: 'overview', label: navigationCopy.groups.overview, order: 1, items: [
    { id: 'dashboard', label: navigationCopy.dashboard, hash: '/dashboard', icon: 'dashboard', order: 1, state: 'available' }
  ] },
  { id: 'leads', label: navigationCopy.groups.leads, order: 2, items: [
    { id: 'inbox', label: navigationCopy.inbox, hash: '/inbox', icon: 'chat', order: 1, state: 'preview', requiredPermission: 'lead_view' }
  ] },
  { id: 'management', label: navigationCopy.groups.management, order: 3, items: [
    { id: 'dataManagement', label: navigationCopy.managementCenter, hash: DATA_MANAGEMENT_ROOT, icon: 'database', order: 1, state: 'available', requiredPermission: 'lead_view', children: DATA_MANAGEMENT_ITEMS }
  ] },
  { id: 'development', label: navigationCopy.groups.development, order: 4, items: [
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
  return DATA_MANAGEMENT_ITEMS.filter((item) => canAccessNavigationItem(item, permissions));
}

export function visibleDataManagementGroups(permissions: NavigationPermissions | null): readonly DataManagementGroupDef[] {
  return DATA_MANAGEMENT_GROUP_DEFS
    .map(({ title, items }) => ({ title, items: items.filter((item) => canAccessNavigationItem(item, permissions)) }))
    .filter(({ items }) => items.length > 0);
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
