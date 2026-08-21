import { Outlet, useLocation } from 'react-router-dom';
import { CRM_NAV_ICONS } from '../../app/icons';
import { DATA_MANAGEMENT_GROUP_DEFS, type NavigationItem } from '../../app/navigation';
import { HubShell, PageHeader, SubMenu } from '../../components/ui';
import { dataManagementCopy } from '../../content/ja';

export function DataManagementPage({ navigationItems }: { navigationItems: readonly NavigationItem[] }) {
  const location = useLocation();
  const activeItem = navigationItems.find((item) => location.pathname === item.hash || location.pathname.startsWith(`${item.hash}/`));
  const groups = DATA_MANAGEMENT_GROUP_DEFS
    .map(({ title, items }) => ({
      title,
      items: items
        .filter((defItem) => navigationItems.some((ni) => ni.id === defItem.id))
        .map((item) => { const Icon = CRM_NAV_ICONS[item.icon]; return { key: item.id, label: item.label, to: item.hash, icon: <Icon aria-hidden="true" /> }; })
    }))
    .filter(({ items }) => items.length > 0);

  return <><PageHeader title={dataManagementCopy.title} subtitle={dataManagementCopy.subtitle} /><HubShell navigationLabel={dataManagementCopy.navigationLabel} navigation={<SubMenu variant="grouped" groups={groups} activeKey={activeItem?.id} ariaLabel={dataManagementCopy.navigationLabel} />}><Outlet /></HubShell></>;
}
