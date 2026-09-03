import {
  getCoreCustomerTaxNumbers as getCoreCustomerTaxNumbers_,
  getCoreTaxNumberTypes as getCoreTaxNumberTypes_,
  upsertCoreCustomerTaxNumber as upsertCoreCustomerTaxNumber_,
  type CustomerTaxNumberRecord,
  type TaxNumberTypeRecord,
  type UpsertCustomerTaxNumberPayload,
  type UpsertCustomerTaxNumberResult,
} from '../../gas/client';

export type { CustomerTaxNumberRecord, TaxNumberTypeRecord, UpsertCustomerTaxNumberPayload, UpsertCustomerTaxNumberResult };

export function getCoreTaxNumberTypes(): Promise<TaxNumberTypeRecord[]> {
  return getCoreTaxNumberTypes_();
}

export function getCoreCustomerTaxNumbers(customerId: string): Promise<CustomerTaxNumberRecord[]> {
  return getCoreCustomerTaxNumbers_(customerId);
}

export function upsertCoreCustomerTaxNumber(payload: UpsertCustomerTaxNumberPayload): Promise<UpsertCustomerTaxNumberResult> {
  return upsertCoreCustomerTaxNumber_(payload);
}
