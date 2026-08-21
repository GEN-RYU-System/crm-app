import { useEffect, useMemo, useRef } from 'react';
import { canAccessNavigationItem, NAVIGATION_BY_ID, type NavigationPermissions } from './navigation';
import { useSyncPolling, type DomainRefreshers } from './useSyncPolling';
import { useLeadListCache } from '../pages/leads/LeadListCacheContext';
import { useCustomerListCache } from '../pages/customers/CustomerListCacheContext';
import { useInventoryListCache } from '../pages/inventory/InventoryListCacheContext';
import { useOrderListCache } from '../pages/orders/OrderListCacheContext';
import { useStaffListCache } from '../pages/staff/StaffListCacheContext';
import { useQuoteListCache } from '../pages/quotes/QuoteListCacheContext';

export function usePrefetch(permissions: NavigationPermissions | null): void {
  const { ensureLoaded: ensureLeads, refreshAll: refreshLeads } = useLeadListCache();
  const { ensureLoaded: ensureCustomers, refresh: refreshCustomers } = useCustomerListCache();
  const { ensureLoaded: ensureInventory, refresh: refreshInventory } = useInventoryListCache();
  const { ensureLoaded: ensureOrders, refresh: refreshOrders } = useOrderListCache();
  const { ensureLoaded: ensureStaff, refresh: refreshStaff } = useStaffListCache();
  const { ensureLoaded: ensureQuotes, refresh: refreshQuotes } = useQuoteListCache();
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

  // Real-time sync polling: detect signal changes per domain and refresh the cache
  const refreshers = useMemo<DomainRefreshers>(() => ({
    leads:     () => refreshLeads(),
    customers: () => refreshCustomers(),
    inventory: () => refreshInventory(),
    orders:    () => refreshOrders(),
    staff:     () => refreshStaff(),
    quotes:    () => refreshQuotes(),
  }), [refreshLeads, refreshCustomers, refreshInventory, refreshOrders, refreshStaff, refreshQuotes]);

  useSyncPolling(refreshers);
}
