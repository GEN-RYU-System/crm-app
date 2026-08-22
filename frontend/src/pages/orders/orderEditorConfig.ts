import { NAVIGATION_BY_ID } from '../../app/navigation';

export const ORDER_ROUTE_SEGMENTS = {
  create: 'new',
} as const;

export const ORDER_EDITOR_PATHS = {
  list: NAVIGATION_BY_ID.orders.hash,
  create: `${NAVIGATION_BY_ID.orders.hash}/new`,
} as const;

export const PAYMENT_METHODS = ['WISE', 'PAYPAL'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  WISE: 'Wise',
  PAYPAL: 'PayPal',
} as const;

export type OrderLineEditorValues = {
  productId: string;
  productName: string;
  category: string;
  condition: string;
  quantity: string;
  unitPrice: string;
  unitWeight: number;
};

export type OrderEditorValues = {
  customerId: string;
  shippingDestinationId: string;
  paymentDestinationId: string;
  currency: string;
  paymentMethod: string;
  shippingFee: string;
  duty: string;
  otherFee: string;
  discount: string;
  lines: OrderLineEditorValues[];
};

export function emptyOrderLine(): OrderLineEditorValues {
  return {
    productId: '',
    productName: '',
    category: '',
    condition: '',
    quantity: '',
    unitPrice: '',
    unitWeight: 0,
  };
}

export function emptyOrderEditorValues(): OrderEditorValues {
  return {
    customerId: '',
    shippingDestinationId: '',
    paymentDestinationId: '',
    currency: 'USD',
    paymentMethod: 'WISE',
    shippingFee: '',
    duty: '',
    otherFee: '',
    discount: '',
    lines: [emptyOrderLine()],
  };
}

/** Convert fullwidth digits to halfwidth. */
export function toHalfwidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

export function calcLineSubtotal(line: OrderLineEditorValues): number | null {
  const qty = Number(toHalfwidthDigits(line.quantity));
  const price = Number(toHalfwidthDigits(line.unitPrice));
  return Number.isFinite(qty) && Number.isFinite(price) ? qty * price : null;
}

export function calcInvoiceTotal(
  lines: OrderLineEditorValues[],
  shippingFee: string,
  duty: string,
  otherFee: string,
  discount: string,
): number | null {
  const lineTotal = lines.reduce<number | null>((sum, line) => {
    const sub = calcLineSubtotal(line);
    if (sub === null || sum === null) return null;
    return sum + sub;
  }, 0);
  if (lineTotal === null) return null;
  const fee = Number(toHalfwidthDigits(shippingFee)) || 0;
  const d = Number(toHalfwidthDigits(duty)) || 0;
  const other = Number(toHalfwidthDigits(otherFee)) || 0;
  const disc = Number(toHalfwidthDigits(discount)) || 0;
  return lineTotal + fee + d + other - disc;
}
