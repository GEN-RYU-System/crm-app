import { useEffect, useRef } from 'react';
import { canAccessNavigationItem, NAVIGATION_BY_ID, type NavigationPermissions } from './navigation';
import { pingForLatencyCheck } from '../gas/client';
import { useLeadListCache } from '../pages/leads/LeadListCacheContext';
import { useLeadFormOptionsCache } from '../pages/leads/LeadFormOptionsCacheContext';
import { useCustomerListCache } from '../pages/customers/CustomerListCacheContext';
import { useCustomerAggregateCache } from '../features/customers/CustomerAggregateCacheContext';
import { useInventoryProductOptionsCache } from '../pages/inventory/InventoryProductOptionsCacheContext';
import { useSalesOrderListCache } from '../pages/sales-orders/SalesOrderListCacheContext';
import { useStaffListCache } from '../pages/staff/StaffListCacheContext';
import { useQuoteListCache } from '../pages/quotes/QuoteListCacheContext';
import { useCurrencyMasterCache } from '../pages/currency/CurrencyMasterCacheContext';
import { useIssuerMasterCache } from '../pages/data-management/IssuerMasterCacheContext';
import { useInboxConversationDetailCache } from '../pages/inbox/InboxConversationDetailCacheContext';

export function usePrefetch(permissions: NavigationPermissions | null): void {
  const { ensureLoaded: ensureLeads } = useLeadListCache();
  const { ensureLoaded: ensureLeadFormOptions } = useLeadFormOptionsCache();
  const { ensureLoaded: ensureCustomers } = useCustomerListCache();
  const { ensureLoaded: ensureAggregates } = useCustomerAggregateCache();
  const { ensureLoaded: ensureInventoryProductOptions } = useInventoryProductOptionsCache();
  const { ensureLoaded: ensureSalesOrders } = useSalesOrderListCache();
  const { ensureLoaded: ensureStaff } = useStaffListCache();
  const { ensureLoaded: ensureQuotes } = useQuoteListCache();
  const { ensureLoaded: ensureCurrencies } = useCurrencyMasterCache();
  const { ensureLoaded: ensureIssuer } = useIssuerMasterCache();
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
      { name: 'inventoryBatch',         canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.inventory, permissions) || canAccessNavigationItem(NAVIGATION_BY_ID.orders, permissions) || canAccessNavigationItem(NAVIGATION_BY_ID.quotes, permissions), load: () => ensureInventoryProductOptions() },
      { name: 'currencies',             canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.orders, permissions) || canAccessNavigationItem(NAVIGATION_BY_ID.quotes, permissions), load: () => ensureCurrencies() },
      { name: 'salesOrders',            canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.salesOrders, permissions), load: () => ensureSalesOrders() },
      { name: 'staff',                  canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.staff,       permissions), load: () => ensureStaff() },
      { name: 'quotes',                 canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.quotes,      permissions), load: () => ensureQuotes() },
      { name: 'issuer',                 canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.quotes, permissions) || canAccessNavigationItem(NAVIGATION_BY_ID.orders, permissions), load: () => ensureIssuer() },
      { name: 'inboxDetailBulk',        canAccess: canAccessNavigationItem(NAVIGATION_BY_ID.inbox,       permissions), load: () => prefetchBulk() },
    ];

    const timer = setTimeout(() => {
      void (async () => {
        // [TEMP] GAS response time measurement — remove after analysis
        const CONCURRENCY = 6; // pool size; tune based on DEV measurement
        type TimingRow = { name: string; elapsedMs: number | '(skip)'; startMs: number | '-'; endMs: number | '-' };
        const totalStart = Date.now();

        // Measure per-call fixed cost (network + script init) before prefetch pool
        let pingMs: number | null = null;
        const pingT0 = Date.now();
        try { await pingForLatencyCheck(); pingMs = Date.now() - pingT0; } catch { /* swallow */ }

        const skipped: TimingRow[] = steps
          .filter(s => !s.canAccess)
          .map(s => ({ name: s.name, elapsedMs: '(skip)' as const, startMs: '-' as const, endMs: '-' as const }));
        const accessible = steps.filter(s => s.canAccess);
        const results: TimingRow[] = [];

        // Pool: always keep CONCURRENCY workers running, each pulling from queue
        const queue = [...accessible];
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
            for (;;) {
              const step = queue.shift();
              if (!step) break;
              const t0 = Date.now();
              try { await step.load(); } catch { /* prefetch failure is intentionally swallowed */ }
              const t1 = Date.now();
              results.push({ name: step.name, elapsedMs: t1 - t0, startMs: t0, endMs: t1 });
            }
          })
        );

        const totalElapsedMs = Date.now() - totalStart;
        const timings: TimingRow[] = [...skipped, ...results];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__prefetchTimings = { steps: timings, totalElapsedMs, concurrency: CONCURRENCY, pingMs };
        console.log(`[prefetch] ping=${pingMs ?? 'err'}ms`);
        console.table(timings);
        console.log(`[prefetch] total=${totalElapsedMs}ms (concurrency=${CONCURRENCY})`);
        // [/TEMP]
      })();
    }, 0);

    return () => clearTimeout(timer);
  }, [permissions, ensureLeads, ensureLeadFormOptions, ensureCustomers, ensureAggregates, ensureInventoryProductOptions, ensureCurrencies, ensureIssuer, ensureSalesOrders, ensureStaff, ensureQuotes, prefetchBulk]);

}
