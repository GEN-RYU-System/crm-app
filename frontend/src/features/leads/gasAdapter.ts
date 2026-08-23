import { createLead, getLeadDetail, getLeadFormOptions, updateLead } from '../../gas/client';
import type { LeadRepository } from './contracts';

export const leadGasRepository: LeadRepository = {
  getDetail: getLeadDetail,
  create: async (payload) => {
    const result = await createLead(payload);
    return { leadId: result.leadId };
  },
  update: async (sheetName, leadId, payload) => {
    await updateLead(sheetName, leadId, payload);
  },
  getFormOptions: getLeadFormOptions,
};
