import { NAVIGATION_BY_ID } from '../../app/navigation';
import type { DataTableCellAlignment } from '../../components/ui';
import type { CustomerProfileDto, CustomerSummaryDto, ShippingAddressDto, PaymentProfileDto } from '../../features/customers/contracts';
import { customersCopy } from '../../content/ja';

export type CustomerListRow = {
  customerId: string;
  customerName: string;
  customerType: string;
  emailAddress: string;
  country: string;
  shippingAddressCount: string;
  paymentProfileCount: string;
  status: string;
  updatedAt: string;
  updatedAtRaw: string;
};

export type CustomerSortKey = Exclude<keyof CustomerListRow, 'customerId' | 'updatedAtRaw'>;
export type CustomerSortDirection = 'ascending' | 'descending';
export type CustomerSort = { key: CustomerSortKey; direction: CustomerSortDirection };
export type CustomerDetailTab = 'basic' | 'shipping' | 'payment';

export const CUSTOMER_ROUTE_SEGMENTS = { detail: ':customerId' } as const;
export const CUSTOMER_LIST_INITIAL_SORT: CustomerSort = { key: 'updatedAt', direction: 'descending' };
export const CUSTOMER_DETAIL_TABS: readonly { key: CustomerDetailTab; label: string }[] = [
  { key: 'basic', label: customersCopy.tabs.basic },
  { key: 'shipping', label: customersCopy.tabs.shipping },
  { key: 'payment', label: customersCopy.tabs.payment }
];
export const CUSTOMER_LIST_COLUMNS: readonly { key: CustomerSortKey; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'customerName', label: customersCopy.columns.customerName, cellAlignment: 'center' },
  { key: 'customerType', label: customersCopy.columns.customerType, cellAlignment: 'center' },
  { key: 'emailAddress', label: customersCopy.columns.emailAddress, cellAlignment: 'center' },
  { key: 'country', label: customersCopy.columns.country, cellAlignment: 'center' },
  { key: 'shippingAddressCount', label: customersCopy.columns.shippingAddressCount, cellAlignment: 'center' },
  { key: 'paymentProfileCount', label: customersCopy.columns.paymentProfileCount, cellAlignment: 'center' },
  { key: 'status', label: customersCopy.columns.status, cellAlignment: 'center' },
  { key: 'updatedAt', label: customersCopy.columns.updatedAt, cellAlignment: 'center' }
];
export const CUSTOMER_LIST_SEARCH_COLUMNS: readonly CustomerSortKey[] = CUSTOMER_LIST_COLUMNS.map(({ key }) => key);
export const CUSTOMER_PROFILE_FIELDS: readonly { key: keyof Pick<CustomerProfileDto, 'customerId' | 'customerName' | 'customerType' | 'emailAddress' | 'country' | 'note'>; label: string }[] = [
  { key: 'customerId', label: customersCopy.fields.customerId },
  { key: 'customerName', label: customersCopy.fields.customerName },
  { key: 'customerType', label: customersCopy.fields.customerType },
  { key: 'emailAddress', label: customersCopy.fields.emailAddress },
  { key: 'country', label: customersCopy.fields.country },
  { key: 'note', label: customersCopy.fields.note }
];
export const CUSTOMER_SHIPPING_COLUMNS: readonly { key: keyof Pick<ShippingAddressDto, 'label' | 'recipient' | 'country' | 'address'>; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'label', label: customersCopy.shippingLabel, cellAlignment: 'center' },
  { key: 'recipient', label: customersCopy.columns.recipient, cellAlignment: 'center' },
  { key: 'country', label: customersCopy.columns.country, cellAlignment: 'center' },
  { key: 'address', label: customersCopy.columns.address, cellAlignment: 'center' }
];
export const CUSTOMER_PAYMENT_COLUMNS: readonly { key: keyof Pick<PaymentProfileDto, 'label' | 'method' | 'status'>; label: string; cellAlignment: DataTableCellAlignment }[] = [
  { key: 'label', label: customersCopy.columns.paymentLabel, cellAlignment: 'center' },
  { key: 'method', label: customersCopy.columns.paymentMethod, cellAlignment: 'center' },
  { key: 'status', label: customersCopy.columns.status, cellAlignment: 'center' }
];

function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ja-JP'); }
export function toCustomerListRows(customers: readonly CustomerSummaryDto[], sort: CustomerSort): CustomerListRow[] {
  const rows = customers.map((customer) => ({ customerId: customer.customerId, customerName: customer.customerName, customerType: customer.customerType, emailAddress: customer.emailAddress, country: customer.country, shippingAddressCount: String(customer.shippingAddressCount), paymentProfileCount: String(customer.paymentProfileCount), status: customer.status, updatedAt: formatDate(customer.updatedAt), updatedAtRaw: customer.updatedAt }));
  const direction = sort.direction === 'ascending' ? 1 : -1;
  return rows.sort((left, right) => sort.key === 'updatedAt'
    ? (new Date(left.updatedAtRaw).getTime() - new Date(right.updatedAtRaw).getTime()) * direction
    : left[sort.key].localeCompare(right[sort.key], 'ja-JP', { numeric: true, sensitivity: 'base' }) * direction);
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
