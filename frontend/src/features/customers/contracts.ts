export type CustomerSummaryDto = {
  customerId: string;
  customerName: string;
  country: string;
  salesChannel: string;
  handledTitle: string;
  salesAssigneeName: string;
  transactionCount: number;
  transactionAmounts: readonly { currency: string; amount: number }[];
};

export type CustomerProfileDto = {
  customerId: string;
  sourceLeadId: string;
  customerName: string;
  country: string;
  emailAddress: string;
  phone: string;
  countryCode: string;
  firstTransactionDate: string;
  registeredAt: string;
  salesAssigneeName: string;
  contactTool: string;
  shippingNote: string;
  shippingAddressCount: number;
  paymentProfileCount: number;
};

export type ShippingAddressDto = {
  addressId: string;
  displayName: string;
  recipient: string;
  country: string;
  address: string;
  phone: string;
  emailAddress: string;
  isDefault: string;
  isActive: string;
};

export type PaymentProfileDto = {
  paymentProfileId: string;
  displayName: string;
  billingName: string;
  country: string;
  address: string;
  method: string;
  currency: string;
  isDefault: string;
  isActive: string;
};

export type CustomerAggregateDto = {
  profile: CustomerProfileDto;
  shippingAddresses: readonly ShippingAddressDto[];
  paymentProfiles: readonly PaymentProfileDto[];
};

export type CustomerAggregatesRecord = Readonly<Record<string, {
  shippingAddresses: readonly ShippingAddressDto[];
  paymentProfiles: readonly PaymentProfileDto[];
}>>;
export type CustomerRepository = {
  listCustomers: (forceRefresh?: boolean) => Promise<readonly CustomerSummaryDto[]>;
  getCustomer: (customerId: string) => Promise<CustomerAggregateDto | null>;
  listCustomerAggregates: () => Promise<CustomerAggregatesRecord>;
};
