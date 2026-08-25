import { useCallback, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY } from '../../app/createListCache';
import type { DashboardKpis, DashboardRepository } from '../../features/dashboard/contracts';

const { Provider: BaseProvider, useCache } = createListCache<DashboardKpis>({ name: 'dashboard KPIs' });

export function DashboardKpiCacheProvider({ repository, children }: PropsWithChildren<{ repository: DashboardRepository }>) {
  const fetcher = useCallback(async () => [await repository.getKpis()], [repository]);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useDashboardKpiCache() {
  const { itemsByKey, errorByKey, loadingByKey, ensureLoaded, refresh } = useCache();
  return {
    kpis: itemsByKey[SINGLE_KEY]?.[0] ?? null,
    error: errorByKey[SINGLE_KEY] ?? '',
    loading: loadingByKey[SINGLE_KEY] ?? false,
    ensureLoaded: useCallback(() => ensureLoaded(), [ensureLoaded]),
    refresh: useCallback(() => refresh(), [refresh]),
  };
}
