import { useCallback, useMemo, type PropsWithChildren } from 'react';
import { createListCache, SINGLE_KEY } from '../../app/createListCache';
import { getCoreCurrencies, type CurrencyRecord } from '../../gas/client';

const { Provider: BaseProvider, useCache } = createListCache<CurrencyRecord>({ name: 'currencies' });

export function CurrencyMasterCacheProvider({ children }: PropsWithChildren) {
  const fetcher = useCallback(() => getCoreCurrencies(), []);
  return <BaseProvider fetcher={fetcher}>{children}</BaseProvider>;
}

export function useCurrencyMasterCache() {
  const { itemsByKey, errorByKey, loadingByKey, refreshing, ensureLoaded, refresh, retry } = useCache();
  return {
    currencies: itemsByKey[SINGLE_KEY] ?? [],
    error: errorByKey[SINGLE_KEY],
    loading: loadingByKey[SINGLE_KEY] ?? false,
    refreshing,
    ensureLoaded: useCallback(() => ensureLoaded(), [ensureLoaded]),
    refresh: useCallback(() => refresh(), [refresh]),
    retry: useCallback(() => retry(), [retry]),
  };
}

export function useCurrencySymbolMap(): Readonly<Record<string, string>> {
  const { currencies } = useCurrencyMasterCache();
  return useMemo(() => {
    const symbolMap: Record<string, string> = {};
    for (const currency of currencies) {
      if (currency.symbol) symbolMap[currency.currencyCode] = currency.symbol;
    }
    return symbolMap;
  }, [currencies]);
}
