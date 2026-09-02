import { NAVIGATION_BY_ID } from '../../app/navigation';
import type { DataTableCellAlignment } from '../../components/ui';
import type { CustomerProfileDto, CustomerSummaryDto, ShippingAddressDto, PaymentProfileDto } from '../../features/customers/contracts';
import { customersCopy } from '../../content/ja';

export function resolveAssigneeName(
  salesAssigneeId: string | undefined,
  staffMap: ReadonlyMap<string, string>,
): string {
  if (salesAssigneeId) {
    return staffMap.get(salesAssigneeId) ?? '';
  }
  return '';
}

export type CustomerListRow = {
  customerId: string;
  customerName: string;
  country: string;
  salesChannel: string;
  handledTitle: string;
  salesAssigneeName: string;
  transactionCount: string;
  transactionAmount: string;
  transactionAmounts: CustomerSummaryDto['transactionAmounts'];
};

export type CustomerListColumnKey = Exclude<keyof CustomerListRow, 'customerId' | 'transactionAmounts'>;
export type CustomerSortKey = CustomerListColumnKey;
export type CustomerSortDirection = 'ascending' | 'descending';
export type CustomerSort = { key: CustomerSortKey; direction: CustomerSortDirection };
export type CustomerDetailTab = 'basic' | 'shipping' | 'payment';

export const CUSTOMER_ROUTE_SEGMENTS = { detail: ':customerId' } as const;
export const CUSTOMER_LIST_INITIAL_SORT: CustomerSort = { key: 'customerName', direction: 'ascending' };
export const CUSTOMER_DETAIL_TABS: readonly { key: CustomerDetailTab; label: string }[] = [
  { key: 'basic', label: customersCopy.tabs.basic },
  { key: 'shipping', label: customersCopy.tabs.shipping },
  { key: 'payment', label: customersCopy.tabs.payment }
];
export const CUSTOMER_LIST_COLUMNS: readonly { key: CustomerListColumnKey; label: string; cellAlignment: DataTableCellAlignment; sortable: boolean }[] = [
  { key: 'customerName', label: customersCopy.columns.customerName, cellAlignment: 'center', sortable: true },
  { key: 'country', label: customersCopy.columns.country, cellAlignment: 'center', sortable: true },
  { key: 'salesChannel', label: customersCopy.columns.salesChannel, cellAlignment: 'center', sortable: true },
  { key: 'handledTitle', label: customersCopy.columns.handledTitle, cellAlignment: 'center', sortable: true },
  { key: 'salesAssigneeName', label: customersCopy.columns.salesAssigneeName, cellAlignment: 'center', sortable: true },
  { key: 'transactionCount', label: customersCopy.columns.transactionCount, cellAlignment: 'center', sortable: true },
  { key: 'transactionAmount', label: customersCopy.columns.transactionAmount, cellAlignment: 'center', sortable: true }
];
export const CUSTOMER_LIST_SEARCH_COLUMNS: readonly CustomerListColumnKey[] = CUSTOMER_LIST_COLUMNS.map(({ key }) => key);
export const CUSTOMER_PROFILE_FIELDS: readonly { key: keyof Pick<CustomerProfileDto, 'customerId' | 'customerName' | 'emailAddress' | 'country' | 'phone' | 'countryCode' | 'firstTransactionDate' | 'registeredAt' | 'salesAssigneeName' | 'contactTool' | 'contactMethod' | 'shippingNote'>; label: string }[] = [
  { key: 'customerId', label: customersCopy.fields.customerId },
  { key: 'customerName', label: customersCopy.fields.customerName },
  { key: 'emailAddress', label: customersCopy.fields.emailAddress },
  { key: 'country', label: customersCopy.fields.country },
  { key: 'phone', label: customersCopy.fields.phone },
  { key: 'countryCode', label: customersCopy.fields.countryCode },
  { key: 'firstTransactionDate', label: customersCopy.fields.firstTransactionDate },
  { key: 'registeredAt', label: customersCopy.fields.registeredAt },
  { key: 'salesAssigneeName', label: customersCopy.fields.salesAssigneeName },
  { key: 'contactTool', label: customersCopy.fields.contactTool },
  { key: 'contactMethod', label: customersCopy.fields.contactMethod },
  { key: 'shippingNote', label: customersCopy.fields.shippingNote }
];
export const CUSTOMER_SHIPPING_COLUMNS: readonly { key: keyof Pick<ShippingAddressDto, 'recipient' | 'country' | 'address' | 'phone' | 'emailAddress' | 'isDefault' | 'isActive'>; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'recipient', label: customersCopy.columns.recipient, cellAlignment: 'center' },
  { key: 'country', label: customersCopy.columns.country, cellAlignment: 'center' },
  { key: 'address', label: customersCopy.columns.address, cellAlignment: 'center' },
  { key: 'phone', label: customersCopy.columns.phone, cellAlignment: 'center' },
  { key: 'emailAddress', label: customersCopy.columns.emailAddress, cellAlignment: 'center' },
  { key: 'isDefault', label: customersCopy.columns.defaultFlag, cellAlignment: 'center' },
  { key: 'isActive', label: customersCopy.columns.activeFlag, cellAlignment: 'center' }
];
export const CUSTOMER_PAYMENT_COLUMNS: readonly { key: keyof Pick<PaymentProfileDto, 'billingName' | 'country' | 'address' | 'method' | 'currency' | 'isDefault' | 'isActive'>; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'billingName', label: customersCopy.columns.billingName, cellAlignment: 'center' },
  { key: 'country', label: customersCopy.columns.country, cellAlignment: 'center' },
  { key: 'address', label: customersCopy.columns.address, cellAlignment: 'center' },
  { key: 'method', label: customersCopy.columns.paymentMethod, cellAlignment: 'center' },
  { key: 'currency', label: customersCopy.columns.currency, cellAlignment: 'center' },
  { key: 'isDefault', label: customersCopy.columns.defaultFlag, cellAlignment: 'center' },
  { key: 'isActive', label: customersCopy.columns.activeFlag, cellAlignment: 'center' }
];

function formatTransactionAmounts(amounts: CustomerSummaryDto['transactionAmounts']): string {
  if (amounts.length === 0) return customersCopy.emptyValue;
  return amounts.map(({ currency, amount }) => `${currency ? `${currency} ` : ''}${amount.toLocaleString('ja-JP')}`).join(' / ');
}

function compareTransactionAmounts(left: CustomerSummaryDto['transactionAmounts'], right: CustomerSummaryDto['transactionAmounts']): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftAmount = left[index];
    const rightAmount = right[index];
    if (!leftAmount) return -1;
    if (!rightAmount) return 1;
    const currencyComparison = leftAmount.currency.localeCompare(rightAmount.currency, 'ja-JP', { sensitivity: 'base' });
    if (currencyComparison !== 0) return currencyComparison;
    const amountComparison = leftAmount.amount - rightAmount.amount;
    if (amountComparison !== 0) return amountComparison;
  }
  return 0;
}

export function toCustomerListRows(customers: readonly CustomerSummaryDto[], sort: CustomerSort, staffMap: ReadonlyMap<string, string>): CustomerListRow[] {
  const rows = customers.map((customer) => ({ customerId: customer.customerId, customerName: customer.customerName, country: customer.country, salesChannel: customer.salesChannel, handledTitle: customer.handledTitle, salesAssigneeName: resolveAssigneeName(customer.salesAssigneeId, staffMap), transactionCount: String(customer.transactionCount), transactionAmount: formatTransactionAmounts(customer.transactionAmounts), transactionAmounts: customer.transactionAmounts }));
  const direction = sort.direction === 'ascending' ? 1 : -1;
  return rows.sort((left, right) => {
    const comparison = sort.key === 'transactionAmount'
      ? compareTransactionAmounts(left.transactionAmounts, right.transactionAmounts)
      : left[sort.key].localeCompare(right[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' });
    return (comparison || left.customerName.localeCompare(right.customerName, 'ja-JP', { numeric: true, sensitivity: 'base' })) * direction;
  });
}

export function filterCustomerListRows(rows: readonly CustomerListRow[], query: string): readonly CustomerListRow[] {
  const normalized = query.trim().toLocaleLowerCase('ja-JP');
  return normalized === '' ? rows : rows.filter((row) => CUSTOMER_LIST_SEARCH_COLUMNS.some((key) => row[key].toLocaleLowerCase('ja-JP').includes(normalized)));
}

export function customerDetailPath(customerId: string): string { return `${NAVIGATION_BY_ID.customers.hash}/${encodeURIComponent(customerId)}`; }
export function customerListPath(): string { return NAVIGATION_BY_ID.customers.hash; }
export function displayCustomerProfileValue(profile: CustomerProfileDto, key: (typeof CUSTOMER_PROFILE_FIELDS)[number]['key']): string { return profile[key]; }
export function displayShippingValue(address: ShippingAddressDto, key: (typeof CUSTOMER_SHIPPING_COLUMNS)[number]['key']): string { return address[key]; }
export function displayPaymentValue(profile: PaymentProfileDto, key: (typeof CUSTOMER_PAYMENT_COLUMNS)[number]['key']): string { return profile[key]; }
