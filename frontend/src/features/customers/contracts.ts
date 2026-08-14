export type CustomerCategory = 'company' | 'individual';
export type CustomerStatus = 'active' | 'inactive' | 'pending';
export type CountryCode = 'JP' | 'US' | 'GB';
export type PaymentMethod = 'card' | 'transfer' | 'invoice';

export type CustomerSummaryDto = {
  customerId: string;
  customerName: string;
  customerType: CustomerCategory;
  emailAddress: string;
  country: CountryCode;
  shippingAddressCount: number;
  paymentProfileCount: number;
  status: CustomerStatus;
  updatedAt: string;
};

export type CustomerProfileDto = CustomerSummaryDto & {
  note: string;
};

export type ShippingAddressDto = {
  addressId: string;
  label: 'primary' | 'secondary';
  recipient: string;
  country: CountryCode;
  address: string;
};

export type PaymentProfileDto = {
  paymentProfileId: string;
  label: 'primary' | 'secondary';
  method: PaymentMethod;
  status: CustomerStatus;
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
