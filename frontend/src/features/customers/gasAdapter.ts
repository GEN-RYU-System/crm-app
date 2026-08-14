import { getCoreCustomer, getCoreCustomers } from '../../gas/client';
import type { CustomerRepository } from './contracts';

export const customerGasRepository: CustomerRepository = {
  listCustomers: getCoreCustomers,
  getCustomer: getCoreCustomer
};
