import { Outlet, useLocation } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import type { NavigationItem } from '../../app/navigation';
import { HubShell, PageHeader, SubMenu, type SubMenuGroup } from '../../components/ui';
import { dataManagementCopy } from '../../content/ja';

export function DataManagementPage({ navigationItems }: { navigationItems: readonly NavigationItem[] }) {
  const location = useLocation();
  const activeItem = navigationItems.find((item) => location.pathname === item.hash || location.pathname.startsWith(`${item.hash}/`));
  const groups: readonly SubMenuGroup[] = [{
    title: dataManagementCopy.groupTitle,
    items: navigationItems.map((item) => {
      const Icon = CRM_NAV_ICONS[item.icon];
      return { key: item.id, label: item.label, to: item.hash, icon: <Icon aria-hidden="true" /> };
    })
  }];

  return <><PageHeader title={dataManagementCopy.title} subtitle={dataManagementCopy.subtitle} /><HubShell navigationLabel={dataManagementCopy.navigationLabel} navigation={<SubMenu variant="grouped" groups={groups} activeKey={activeItem?.id} ariaLabel={dataManagementCopy.navigationLabel} />}><Outlet /></HubShell></>;
}
