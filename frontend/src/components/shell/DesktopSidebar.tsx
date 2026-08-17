import { NavLink } from 'react-router-dom';
import { SidebarNav } from './SidebarNav';
import type { NavigationGroup } from '../../app/navigation';
import { authCopy } from '../../content/ja/auth';
import { useAuth } from '../../contexts/AuthContext';
import './DesktopSidebar.css';

type Props = { expanded: boolean; hoverSuppressed: boolean; onMouseEnter: () => void; onMouseLeave: () => void; onNavClick: () => void; navigationGroups: readonly NavigationGroup[] };

function SidebarFooter() {
  const { logout } = useAuth();
  return (
    <div className="shell-desktop-sidebar__footer">
      <NavLink to="/change-password" className="shell-sidebar-nav__item shell-desktop-sidebar__footer-link">
        <span className="shell-sidebar-nav__label">{authCopy.changePasswordLink}</span>
      </NavLink>
      <button
        type="button"
        className="shell-sidebar-nav__item shell-desktop-sidebar__footer-btn"
        onClick={() => void logout()}
      >
        <span className="shell-sidebar-nav__label">{authCopy.logoutButton}</span>
      </button>
    </div>
  );
}

export function DesktopSidebar({ expanded, hoverSuppressed, onMouseEnter, onMouseLeave, onNavClick, navigationGroups }: Props) {
  return (
    <aside
      className={`shell-desktop-sidebar${expanded ? ' shell-desktop-sidebar--expanded' : ''}${hoverSuppressed ? ' shell-desktop-sidebar--hover-suppressed' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="shell-desktop-sidebar__brand">
        <span className="shell-desktop-sidebar__mark" aria-hidden="true">C</span>
        <span className="shell-desktop-sidebar__name">CRM</span>
      </div>
      <SidebarNav onNavClick={onNavClick} navigationGroups={navigationGroups} />
      <SidebarFooter />
    </aside>
  );
}
