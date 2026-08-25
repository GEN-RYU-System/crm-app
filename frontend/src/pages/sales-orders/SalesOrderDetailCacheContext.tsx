import { useCallback, type PropsWithChildren } from 'react';
import { createListCache } from '../../app/createListCache';
import { getCoreOrderDetail, type OrderDetailRecord } from '../../gas/client';

const { Provider: BaseProvider, useCache } = createListCache<OrderDetailRecord, string>({ name: 'sales order details' });

export function SalesOrderDetailCacheProvider({ children }: PropsWithChildren) {
  const fetcher = useCallback(async (orderId: string) => {
    const detail = await getCoreOrderDetail(orderId);
    return detail === null ? [] : [detail];
  }, []);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useSalesOrderDetailCache() {
  const { itemsByKey, errorByKey, ensureLoaded, refresh } = useCache();
  return {
    recordsByOrderId: itemsByKey,
    errorsByOrderId: errorByKey,
    ensureLoaded: useCallback((orderId: string) => ensureLoaded(orderId), [ensureLoaded]),
    refresh: useCallback((orderId: string) => refresh(orderId), [refresh]),
  };
}
