import { getCoreQuotes, getCoreCurrencies } from '../../gas/client';
import type { QuoteRepository } from './contracts';

export const quoteGasRepository: QuoteRepository = {
  listQuotes: (forceRefresh) => getCoreQuotes(forceRefresh),
  listCurrencySymbols: async () => {
    const currencies = await getCoreCurrencies();
    const map: Record<string, string> = {};
    for (const c of currencies) {
      if (c.symbol) map[c.currencyCode] = c.symbol;
    }
    return map;
  },
};
