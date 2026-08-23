export type { LeadFormCountry, LeadFormOptions, LeadType } from '../../gas/client';
export type LeadDetail = Record<string, unknown>;
export type LeadCreatePayload = Record<string, string>;
export type LeadUpdatePayload = Record<string, string>;

export type LeadRepository = {
  getDetail: (leadId: string) => Promise<LeadDetail | null>;
  create: (payload: LeadCreatePayload) => Promise<{ leadId: string }>;
  update: (sheetName: string, leadId: string, payload: LeadUpdatePayload) => Promise<void>;
  getFormOptions: () => Promise<import('../../gas/client').LeadFormOptions>;
};
