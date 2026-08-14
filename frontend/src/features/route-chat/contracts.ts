export type RouteChatPreviewCustomer = { id: string; name: string; route: string; summary: string; updatedAt: string };
export type RouteChatPreviewMessage = { id: string; sender: 'customer' | 'operator'; body: string; sentAt: string };
export type RouteChatPreviewDetails = { nextAction: string; responseSpeed: string; temperature: string; opportunityNote: string; customerCategory: string; contactChannel: string };
export type RouteChatPreviewModel = { customers: readonly RouteChatPreviewCustomer[]; messagesByCustomer: Readonly<Record<string, readonly RouteChatPreviewMessage[]>>; detailsByCustomer: Readonly<Record<string, RouteChatPreviewDetails>> };
