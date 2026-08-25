import { getInboxConversationDetail, getInboxConversations } from '../../gas/client';
import type { InboxRepository } from './contracts';

export const inboxGasRepository: InboxRepository = {
  listConversations: (forceRefresh) => getInboxConversations(forceRefresh),
  getConversation: (id: string) => getInboxConversationDetail(id),
};
