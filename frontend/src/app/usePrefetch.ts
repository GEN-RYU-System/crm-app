import { useEffect, useRef } from 'react';
import { canAccessNavigationItem, NAVIGATION_BY_ID, type NavigationPermissions } from './navigation';
import { useLeadListCache } from '../pages/leads/LeadListCacheContext';
import { useCustomerListCache } from '../pages/customers/CustomerListCacheContext';
import { useInventoryListCache } from '../pages/inventory/InventoryListCacheContext';
import { useOrderListCache } from '../pages/orders/OrderListCacheContext';
import { useStaffListCache } from '../pages/staff/StaffListCacheContext';
import { useQuoteListCache } from '../pages/quotes/QuoteListCacheContext';

export function usePrefetch(permissions: NavigationPermissions | null): void {
  const { ensureLoaded: ensureLeads } = useLeadListCache();
  const { ensureLoaded: ensureCustomers } = useCustomerListCache();
  const { ensureLoaded: ensureInventory } = useInventoryListCache();
  const { ensureLoaded: ensureOrders } = useOrderListCache();
  const { ensureLoaded: ensureStaff } = useStaffListCache();
  const { ensureLoaded: ensureQuotes } = useQuoteListCache();
  const hasRun = useRef(false);

  useEffect(() => {
    if (permissions === null || hasRun.current) return;
    hasRun.current = true;

    const steps: Array<{ canAccess: boolean; load: () => Promise<void> }> = [
      { canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.leads,      permissions), load: () => ensureLeads('all') },
      { canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.customers,  permissions), load: () => ensureCustomers() },
      { canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.inventory,  permissions), load: () => ensureInventory() },
      { canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.orders,     permissions), load: () => ensureOrders() },
      { canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.staff,      permissions), load: () => ensureStaff() },
      { canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.quotes,     permissions), load: () => ensureQuotes() },
    ];

    const timer = setTimeout(() => {
      void (async () => {
        for (const step of steps) {
          if (!step.canAccess) continue;
          try { await step.load(); } catch { /* prefetch failure is intentionally swallowed */ }
        }
      })();
    }, 0);

    return () => clearTimeout(timer);
  }, [permissions, ensureLeads, ensureCustomers, ensureInventory, ensureOrders, ensureStaff, ensureQuotes]);

}
