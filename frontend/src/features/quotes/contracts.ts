import type { QuoteRecord } from '../../gas/client';

export type { QuoteRecord };

export type QuoteRepository = {
  listQuotes: (forceRefresh?: boolean) => Promise<readonly QuoteRecord[]>;
};
