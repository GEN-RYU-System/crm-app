function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return value;
  const raw = String(value).replace(/,/g, '').trim();
  if (raw === '') return NaN;
  return Number(raw);
}

const INTL_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatAmountWithJpy(
  amount: unknown,
  currency: string,
  amountJpy: unknown,
  symbolMap: Record<string, string>,
): { display: string; jpy: number } {
  const num = parseAmount(amount);
  if (!Number.isFinite(num)) return { display: '-', jpy: 0 };

  const primarySymbol = symbolMap[currency] ?? null;
  const primaryFormatted = INTL_FORMAT.format(Math.round(num));
  const primaryStr =
    primarySymbol != null
      ? `${primarySymbol}${primaryFormatted}`
      : currency
        ? `${currency} ${primaryFormatted}`
        : primaryFormatted;

  if (currency === 'JPY') return { display: primaryStr, jpy: num };

  const jpyNum = parseAmount(amountJpy);
  if (!Number.isFinite(jpyNum) || jpyNum === 0) return { display: primaryStr, jpy: 0 };

  const jpySymbol = symbolMap['JPY'] ?? '\u00A5';
  const jpyFormatted = INTL_FORMAT.format(Math.round(jpyNum));
  // \uFF08 = \uFF09 = fullwidth parentheses
  return {
    display: `${jpySymbol}${jpyFormatted}\uFF08${primaryStr}\uFF09`,
    jpy: jpyNum,
  };
}
