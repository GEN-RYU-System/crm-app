import { useEffect, useRef } from 'react';
import { canAccessNavigationItem, NAVIGATION_BY_ID, type NavigationPermissions } from './navigation';
import { useLeadListCache } from '../pages/leads/LeadListCacheContext';
import { useLeadFormOptionsCache } from '../pages/leads/LeadFormOptionsCacheContext';
import { useCustomerListCache } from '../pages/customers/CustomerListCacheContext';
import { useCustomerAggregateCache } from '../features/customers/CustomerAggregateCacheContext';
import { useInventoryListCache } from '../pages/inventory/InventoryListCacheContext';
import { useInventoryProductOptionsCache } from '../pages/inventory/InventoryProductOptionsCacheContext';
import { useOrderListCache } from '../pages/orders/OrderListCacheContext';
import { useSalesOrderListCache } from '../pages/sales-orders/SalesOrderListCacheContext';
import { useStaffListCache } from '../pages/staff/StaffListCacheContext';
import { useQuoteListCache } from '../pages/quotes/QuoteListCacheContext';
import { useCurrencyMasterCache } from '../pages/currency/CurrencyMasterCacheContext';
import { useIssuerMasterCache } from '../pages/data-management/IssuerMasterCacheContext';
import { useInboxConversationListCache } from '../pages/inbox/InboxConversationListCacheContext';
import { useInboxConversationDetailCache } from '../pages/inbox/InboxConversationDetailCacheContext';

export function usePrefetch(permissions: NavigationPermissions | null): void {
  const { ensureLoaded: ensureLeads } = useLeadListCache();
  const { ensureLoaded: ensureLeadFormOptions } = useLeadFormOptionsCache();
  const { ensureLoaded: ensureCustomers } = useCustomerListCache();
  const { ensureLoaded: ensureAggregates } = useCustomerAggregateCache();
  const { ensureLoaded: ensureInventory } = useInventoryListCache();
  const { ensureLoaded: ensureInventoryProductOptions } = useInventoryProductOptionsCache();
  const { ensureLoaded: ensureOrders } = useOrderListCache();
  const { ensureLoaded: ensureSalesOrders } = useSalesOrderListCache();
  const { ensureLoaded: ensureStaff } = useStaffListCache();
  const { ensureLoaded: ensureQuotes } = useQuoteListCache();
  const { ensureLoaded: ensureCurrencies } = useCurrencyMasterCache();
  const { ensureLoaded: ensureIssuer } = useIssuerMasterCache();
  const { ensureLoaded: ensureInboxConversations } = useInboxConversationListCache();
  const { prefetchBulk } = useInboxConversationDetailCache();
  const hasRun = useRef(false);

  useEffect(() => {
    if (permissions === null || hasRun.current) return;
    hasRun.current = true;

    const steps: Array<{ name: string; canAccess: boolean; load: () => Promise<void> }> = [
      { name: 'leads',                  canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.leads,       permissions), load: () => ensureLeads('all') },
      { name: 'leadFormOptions',        canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.leads,       permissions), load: () => ensureLeadFormOptions() },
      { name: 'customers',              canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.customers,   permissions), load: () => ensureCustomers() },
      { name: 'customerAggregates',     canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.orders,      permissions), load: () => ensureAggregates() },
      { name: 'inventory',              canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.inventory,   permissions), load: () => ensureInventory() },
      { name: 'inventoryProductOptions',canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.orders, permissions) || canAccessNavigationItem(NAVIGATION_BY_ID.quotes, permissions), load: () => ensureInventoryProductOptions() },
      { name: 'orders',                 canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.orders,      permissions), load: () => ensureOrders() },
      { name: 'currencies',             canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.orders, permissions) || canAccessNavigationItem(NAVIGATION_BY_ID.quotes, permissions), load: () => ensureCurrencies() },
      { name: 'salesOrders',            canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.salesOrders, permissions), load: () => ensureSalesOrders() },
      { name: 'staff',                  canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.staff,       permissions), load: () => ensureStaff() },
      { name: 'quotes',                 canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.quotes,      permissions), load: () => ensureQuotes() },
      { name: 'issuer',                 canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.quotes, permissions) || canAccessNavigationItem(NAVIGATION_BY_ID.orders, permissions), load: () => ensureIssuer() },
      { name: 'inboxConversations',     canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.inbox,       permissions), load: () => ensureInboxConversations() },
      { name: 'inboxDetailBulk',        canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.inbox,       permissions), load: () => prefetchBulk() },
    ];

    const timer = setTimeout(() => {
      void (async () => {
        // [TEMP] GAS response time measurement — remove after analysis
        type TimingRow = { name: string; elapsedMs: number | '(skip)'; startMs: number | '-'; endMs: number | '-' };
        const timings: TimingRow[] = [];
        const totalStart = Date.now();
        for (const step of steps) {
          if (!step.canAccess) {
            timings.push({ name: step.name, elapsedMs: '(skip)', startMs: '-', endMs: '-' });
            continue;
          }
          const t0 = Date.now();
          try { await step.load(); } catch { /* prefetch failure is intentionally swallowed */ }
          const t1 = Date.now();
          timings.push({ name: step.name, elapsedMs: t1 - t0, startMs: t0, endMs: t1 });
        }
        const totalElapsedMs = Date.now() - totalStart;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__prefetchTimings = { steps: timings, totalElapsedMs };
        console.table(timings);
        console.log(`[prefetch] total=${totalElapsedMs}ms`);
        // [/TEMP]
      })();
    }, 0);

    return () => clearTimeout(timer);
  }, [permissions, ensureLeads, ensureLeadFormOptions, ensureCustomers, ensureAggregates, ensureInventory, ensureInventoryProductOptions, ensureOrders, ensureCurrencies, ensureIssuer, ensureSalesOrders, ensureStaff, ensureQuotes, ensureInboxConversations, prefetchBulk]);

}
