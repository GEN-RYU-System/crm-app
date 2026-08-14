import type { CustomerAggregateDto, CustomerRepository } from './contracts';

const previewCustomers: readonly CustomerAggregateDto[] = [
  {
    profile: { customerId: 'preview-customer-alpha', customerName: 'Preview Atlas', customerType: 'company', emailAddress: 'atlas@preview.invalid', country: 'JP', shippingAddressCount: 2, paymentProfileCount: 1, status: 'active', updatedAt: '2026-01-14T09:00:00.000Z', note: 'Preview record only.' },
    shippingAddresses: [
      { addressId: 'preview-address-alpha-primary', label: 'primary', recipient: 'Preview Atlas', country: 'JP', address: 'Preview district A' },
      { addressId: 'preview-address-alpha-secondary', label: 'secondary', recipient: 'Preview Atlas', country: 'JP', address: 'Preview district B' }
    ],
    paymentProfiles: [{ paymentProfileId: 'preview-payment-alpha-primary', label: 'primary', method: 'invoice', status: 'active' }]
  },
  {
    profile: { customerId: 'preview-customer-bravo', customerName: 'Preview Bravo', customerType: 'individual', emailAddress: 'bravo@preview.invalid', country: 'US', shippingAddressCount: 1, paymentProfileCount: 2, status: 'pending', updatedAt: '2026-01-11T09:00:00.000Z', note: 'Preview record only.' },
    shippingAddresses: [{ addressId: 'preview-address-bravo-primary', label: 'primary', recipient: 'Preview Bravo', country: 'US', address: 'Preview district C' }],
    paymentProfiles: [
      { paymentProfileId: 'preview-payment-bravo-primary', label: 'primary', method: 'card', status: 'pending' },
      { paymentProfileId: 'preview-payment-bravo-secondary', label: 'secondary', method: 'transfer', status: 'active' }
    ]
  },
  {
    profile: { customerId: 'preview-customer-charlie', customerName: 'Preview Charlie', customerType: 'company', emailAddress: 'charlie@preview.invalid', country: 'GB', shippingAddressCount: 0, paymentProfileCount: 0, status: 'inactive', updatedAt: '2026-01-07T09:00:00.000Z', note: 'Preview record only.' },
    shippingAddresses: [],
    paymentProfiles: []
  }
];

export const customerPreviewRepository: CustomerRepository = {
  async listCustomers() {
    await Promise.resolve();
    return previewCustomers.map(({ profile }) => ({
      customerId: profile.customerId,
      customerName: profile.customerName,
      customerType: profile.customerType,
      emailAddress: profile.emailAddress,
      country: profile.country,
      shippingAddressCount: profile.shippingAddressCount,
      paymentProfileCount: profile.paymentProfileCount,
      status: profile.status,
      updatedAt: profile.updatedAt
    }));
  },
  async getCustomer(customerId) {
    await Promise.resolve();
    return previewCustomers.find((customer) => customer.profile.customerId === customerId) ?? null;
  }
};
