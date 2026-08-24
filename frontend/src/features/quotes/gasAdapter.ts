import { getCoreQuotes } from '../../gas/client';
import type { QuoteRepository } from './contracts';

export const quoteGasRepository: QuoteRepository = {
  listQuotes: (forceRefresh) => getCoreQuotes(forceRefresh),
};
