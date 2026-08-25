import { createDiscordInviteForCustomer, createDiscordTicketForCustomer, getCoreAllCustomerAggregates, getCoreCustomer, getCoreCustomers } from '../../gas/client';
import type { CustomerRepository } from './contracts';

export const customerGasRepository: CustomerRepository = {
  listCustomers: (forceRefresh) => getCoreCustomers(forceRefresh),
  getCustomer: getCoreCustomer,
  listCustomerAggregates: getCoreAllCustomerAggregates,
  createDiscordTicket: createDiscordTicketForCustomer,
  createDiscordInvite: createDiscordInviteForCustomer,
};
