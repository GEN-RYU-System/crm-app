export type CustomerSummaryDto = {
  customerId: string;
  customerName: string;
  emailAddress: string;
  country: string;
  phone: string;
  shippingAddressCount: number;
  paymentProfileCount: number;
  salesAssigneeName: string;
  contactTool: string;
  registeredAt: string;
};

export type CustomerProfileDto = CustomerSummaryDto & {
  sourceLeadId: string;
  countryCode: string;
  firstTransactionDate: string;
  shippingNote: string;
};

export type ShippingAddressDto = {
  addressId: string;
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

export type CustomerRepository = {
  listCustomers: () => Promise<readonly CustomerSummaryDto[]>;
  getCustomer: (customerId: string) => Promise<CustomerAggregateDto | null>;
};
