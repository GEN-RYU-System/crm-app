import { ISSUER_HEADER } from '../../content/ja/issuer';
import type { IssuerRecord, OrderDetailRecord } from '../../gas/client';
import { formatDate } from '../../pages/shared/dateFormat';
import type { IssuerInfo } from './DocumentParts';
import type { InvoiceDocumentProps } from './InvoiceDocument';

export function toDocAmount(value: string | number | undefined | null): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : n.toLocaleString();
}

export function buildIssuerInfo(rec: IssuerRecord): IssuerInfo {
  const get = (key: string): string => {
    const val = rec[key];
    return val === null || val === undefined ? '' : String(val);
  };
  return {
    name: get(ISSUER_HEADER.COMPANY_NAME),
    lines: [
      get(ISSUER_HEADER.ADDRESS_LINE1),
      get(ISSUER_HEADER.ADDRESS_LINE2),
      get(ISSUER_HEADER.ADDRESS_LINE3),
      [get(ISSUER_HEADER.CITY), get(ISSUER_HEADER.STATE), get(ISSUER_HEADER.ZIP)].filter(Boolean).join(' '),
      get(ISSUER_HEADER.COUNTRY),
      get(ISSUER_HEADER.PHONE),
      get(ISSUER_HEADER.EMAIL),
    ].filter(Boolean),
  };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  WISE: 'Wise',
  PAYPAL: 'PayPal',
};

const PAYMENT_METHOD_DESCRIPTIONS: Record<string, string> = {
  WISE: 'E-mail transfer',
  PAYPAL: 'E-mail transfer',
};

function buildPaymentMethodLine(method: string, email: string): string | undefined {
  if (!method) return undefined;
  const label = PAYMENT_METHOD_LABELS[method] ?? method;
  const desc = PAYMENT_METHOD_DESCRIPTIONS[method];
  const prefix = desc ? `Method: ${label} (${desc})` : `Method: ${label}`;
  return email ? `${prefix} · Please send the payment to: ${email}` : prefix;
}

export function buildOrderInvoiceProps(
  detail: OrderDetailRecord,
  issuer: IssuerRecord,
): InvoiceDocumentProps {
  const paymentEmail = String(issuer[ISSUER_HEADER.PAYMENT_EMAIL] ?? '');
  return {
    issuer: buildIssuerInfo(issuer),
    invoiceNumber: detail.order.INVOICE_NUMBER,
    date: formatDate(detail.order.INVOICE_ISSUED_AT || detail.order.ORDER_DATE),
    dueDate: detail.order.PAYMENT_DUE_AT ? formatDate(detail.order.PAYMENT_DUE_AT) : '',
    registrationNumber: String(issuer[ISSUER_HEADER.REGISTRATION_NO] ?? '') || undefined,
    billedTo: {
      name: detail.order.paymentDestinationName || detail.order.customerName,
      lines: [
        detail.order.billingAddressLine1,
        detail.order.billingAddressLine2,
        detail.order.billingAddressLine3,
        [detail.order.billingCity, detail.order.billingState, detail.order.billingZip].filter(Boolean).join(' '),
        detail.order.billingCountry,
        detail.order.billingTaxId ? `TAX ID: ${detail.order.billingTaxId}` : null,
      ].filter(Boolean) as string[],
    },
    shipTo: {
      name: detail.order.shippingRecipientName || detail.order.customerName,
      lines: [
        detail.order.shippingAddressLine1,
        detail.order.shippingAddressLine2,
        detail.order.shippingAddressLine3,
        [detail.order.shippingCity, detail.order.shippingState, detail.order.shippingZip].filter(Boolean).join(' '),
        detail.order.shippingCountry,
      ].filter(Boolean),
    },
    lines: detail.lines.map((l, i) => ({
      no: i + 1,
      name: l.ENGLISH_TITLE || l.PRODUCT_NAME,
      qty: toDocAmount(l.QUANTITY),
      unitPrice: toDocAmount(l.UNIT_PRICE),
      amount: toDocAmount(l.SUBTOTAL),
    })),
    subtotal: toDocAmount(detail.order.LINE_TOTAL),
    shippingFee: toDocAmount(detail.order.SHIPPING_FEE),
    duty: toDocAmount(detail.order.DUTY),
    otherFee: toDocAmount(detail.order.OTHER_FEE),
    discount: toDocAmount(detail.order.DISCOUNT),
    total: toDocAmount(detail.order.INVOICE_TOTAL),
    currency: detail.order.CURRENCY,
    exchangeRate: detail.order.EXCHANGE_RATE ? String(detail.order.EXCHANGE_RATE) : undefined,
    notes: detail.order.SHIPPING_NOTE || undefined,
    paymentMethod: buildPaymentMethodLine(detail.order.PAYMENT_METHOD, paymentEmail),
    paymentTermsNote: String(issuer[ISSUER_HEADER.PAYMENT_NOTE] ?? '') || undefined,
    thanksMessage: String(issuer[ISSUER_HEADER.CLOSING_MESSAGE] ?? '') || undefined,
  };
}
