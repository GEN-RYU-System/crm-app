import { getInboxConversationDetail, getInboxConversations } from '../../gas/client';
import type { InboxRepository } from './contracts';

export const inboxGasRepository: InboxRepository = {
  listConversations: () => getInboxConversations(),
  getConversation: (id: string) => getInboxConversationDetail(id),
};
