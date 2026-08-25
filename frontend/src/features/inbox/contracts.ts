export type InboxStatus = 'all' | 'lead' | 'deal' | 'existing' | 'followup' | 'archive';
export type InboxPlatform = 'all' | 'messenger' | 'instagram' | 'discord';
export type InboxConversationDto = { id: string; customerName: string; platform: Exclude<InboxPlatform, 'all'>; status: Exclude<InboxStatus, 'all'>; summary: string; updatedAt: string; unread: boolean };
export type InboxMessageDto = { id: string; sender: 'customer' | 'operator'; body: string; sentAt: string };
export type InboxKarteDto = { customerName: string; company: string; platform: string; status: string; nextAction: string; note: string };
export type InboxConversationDetailDto = { conversation: InboxConversationDto; messages: readonly InboxMessageDto[]; karte: InboxKarteDto };
export type InboxRepository = { listConversations: (forceRefresh?: boolean) => Promise<readonly InboxConversationDto[]>; getConversation: (id: string) => Promise<InboxConversationDetailDto | null> };
