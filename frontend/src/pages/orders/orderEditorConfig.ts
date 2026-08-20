import { NAVIGATION_BY_ID } from '../../app/navigation';
import type { OrderCreatePayload } from '../../features/orders/contracts';

export type OrderLineEditorValues = {
  productId: string;
  productName: string;
  condition: string;
  quantity: string;
  unitPrice: string;
  unitWeight: number;
};

export type OrderEditorValues = {
  customerId: string;
  customerName: string;
  sourceLeadId: string;
  shippingDestinationId: string;
  paymentDestinationId: string;
  currency: string;
  shippingFee: string;
  duty: string;
  otherFee: string;
  discount: string;
  paymentMethod: string;
  paymentTerms: string;
  paymentDueAt: string;
  note: string;
  lines: OrderLineEditorValues[];
};

export const ORDER_EDITOR_PATHS = {
  list:     NAVIGATION_BY_ID.orders.hash,
  create:   `${NAVIGATION_BY_ID.orders.hash}/new`,
  detail:   `${NAVIGATION_BY_ID.orders.hash}/:orderId`,
  detailFor: (orderId: string) => `${NAVIGATION_BY_ID.orders.hash}/${encodeURIComponent(orderId)}`,
} as const;

export const ORDER_EDITOR_SEGMENTS = {
  create: 'new',
  detail: ':orderId',
} as const;

export const ORDER_LINE_EMPTY: OrderLineEditorValues = {
  productId:   '',
  productName: '',
  condition:   '',
  quantity:    '',
  unitPrice:   '',
  unitWeight:  0,
};

export function emptyOrderEditorValues(): OrderEditorValues {
  return {
    customerId:             '',
    customerName:           '',
    sourceLeadId:           '',
    shippingDestinationId:  '',
    paymentDestinationId:   '',
    currency:               'JPY',
    shippingFee:            '',
    duty:                   '',
    otherFee:               '',
    discount:               '',
    paymentMethod:          '',
    paymentTerms:           '',
    paymentDueAt:           '',
    note:                   '',
    lines:                  [{ ...ORDER_LINE_EMPTY }],
  };
}

function parseOrderNumeric(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const n = Number(normalized);
  if (!isFinite(n)) return null;
  return n;
}

export function toOrderCreatePayload(values: OrderEditorValues): OrderCreatePayload {
  return {
    customerId:            values.customerId,
    shippingDestinationId: values.shippingDestinationId,
    paymentDestinationId:  values.paymentDestinationId,
    sourceLeadId:          values.sourceLeadId,
    currency:              values.currency,
    shippingFee:           parseOrderNumeric(values.shippingFee),
    duty:                  parseOrderNumeric(values.duty),
    otherFee:              parseOrderNumeric(values.otherFee),
    discount:              parseOrderNumeric(values.discount),
    paymentMethod:         values.paymentMethod,
    paymentTerms:          values.paymentTerms,
    paymentDueAt:          values.paymentDueAt,
    note:                  values.note,
    lines:                 values.lines
      .filter((l) => l.productName.trim())
      .map((l, i) => ({
        lineNo:      i + 1,
        productId:   l.productId,
        productName: l.productName,
        condition:   l.condition,
        quantity:    parseOrderNumeric(l.quantity),
        unitPrice:   parseOrderNumeric(l.unitPrice),
      })),
  };
}
