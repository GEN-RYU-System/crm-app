import type { ComponentType, SVGProps } from 'react';
import { ArchiveBoxIcon, ArrowDownIcon, ArrowUpIcon, ArrowsUpDownIcon, BookOpenIcon, BriefcaseIcon, ChartBarIcon, ChatBubbleLeftRightIcon, ChevronDownIcon, CircleStackIcon, ClipboardDocumentListIcon, Cog6ToothIcon, CubeIcon, DocumentTextIcon, LanguageIcon, MapIcon, QuestionMarkCircleIcon, ReceiptPercentIcon, RectangleStackIcon, ShieldCheckIcon, Squares2X2Icon, SwatchIcon, UserGroupIcon, UserPlusIcon, UsersIcon } from '@heroicons/react/24/outline';

export type CrmNavIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** React POC navigation icons. Pages must not import Heroicons directly. */
export const CRM_NAV_ICONS = {
  dashboard: Squares2X2Icon,
  components: SwatchIcon,
  leads: UsersIcon,
  customers: UserGroupIcon,
  chat: ChatBubbleLeftRightIcon,
  newLead: UserPlusIcon,
  route: MapIcon,
  archive: ArchiveBoxIcon,
  inventory: CubeIcon,
  document: DocumentTextIcon,
  history: ClipboardDocumentListIcon,
  invoice: ReceiptPercentIcon,
  reports: ChartBarIcon,
  faq: QuestionMarkCircleIcon,
  deals: BriefcaseIcon,
  staff: UserGroupIcon,
  permissions: ShieldCheckIcon,
  database: CircleStackIcon,
  settings: Cog6ToothIcon,
  knowledge: BookOpenIcon,
  translation: LanguageIcon,
  templates: RectangleStackIcon,
  chevron: ChevronDownIcon
} satisfies Record<string, CrmNavIcon>;

/** React POC sort icons. Pages must not import Heroicons directly. */
export const CRM_SORT_ICONS = {
  none: ArrowsUpDownIcon,
  ascending: ArrowUpIcon,
  descending: ArrowDownIcon
} satisfies Record<'none' | 'ascending' | 'descending', CrmNavIcon>;
