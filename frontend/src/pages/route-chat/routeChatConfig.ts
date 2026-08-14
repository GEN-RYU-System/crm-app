import { routeChatCopy } from '../../content/ja';

export type RouteChatDetailTab = keyof typeof routeChatCopy.detailTabs;
export const ROUTE_CHAT_DETAIL_TABS = (Object.entries(routeChatCopy.detailTabs) as [RouteChatDetailTab, string][]).map(([key, label]) => ({ key, label }));
