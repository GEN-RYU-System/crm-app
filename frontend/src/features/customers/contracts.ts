export type CustomerSummaryDto = {
  customerId: string;
  customerName: string;
  customerType: string;
  emailAddress: string;
  country: string;
  shippingAddressCount: number;
  paymentProfileCount: number;
  status: string;
  updatedAt: string;
};

export type CustomerProfileDto = CustomerSummaryDto & {
  note: string;
};

export type ShippingAddressDto = {
  addressId: string;
  label: string;
  recipient: string;
  country: string;
  address: string;
};

export type PaymentProfileDto = {
  paymentProfileId: string;
  label: string;
  method: string;
  status: string;
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
