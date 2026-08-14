import { inboxCopy } from '../../content/ja';
import type { InboxPlatform, InboxStatus } from '../../features/inbox/contracts';
export const INBOX_STATUS_TABS: readonly { key: InboxStatus; label: string }[] = Object.entries(inboxCopy.statusTabs).map(([key, label]) => ({ key: key as InboxStatus, label }));
export const INBOX_PLATFORM_OPTIONS = [{ value: 'all', label: inboxCopy.allPlatforms }, { value: 'messenger', label: inboxCopy.platforms.messenger }, { value: 'instagram', label: inboxCopy.platforms.instagram }, { value: 'discord', label: inboxCopy.platforms.discord }] satisfies readonly { value: InboxPlatform; label: string }[];
export const INBOX_KARTE_TABS = Object.entries(inboxCopy.detailTabs).map(([key, label]) => ({ key, label }));
