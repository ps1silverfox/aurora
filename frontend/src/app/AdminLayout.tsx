import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { setAuthToken } from '../api/client';
import { Notifications } from '../features/notifications/Notifications';

interface NavItem {
  label: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Pages', path: '/pages' },
  { label: 'Media', path: '/media' },
  { label: 'Data Sources', path: '/data-sources' },
  { label: 'Plugins', path: '/plugins' },
  { label: 'Themes', path: '/themes' },
  { label: 'Users', path: '/users' },
  { label: 'Audit Log', path: '/audit-log' },
  { label: 'Settings', path: '/settings' },
];

interface AdminLayoutProps {
  userName?: string;
  userRole?: string;
}

export function AdminLayout({ userName = 'Admin', userRole = 'administrator' }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  function handleLogout() {
    setAuthToken(null);
    void navigate('/login');
  }

  return (
    <div className={`admin-layout${sidebarOpen ? '' : ' admin-layout--collapsed'}`}>
      <aside className="admin-sidebar" aria-label="Main navigation">
        <div className="admin-sidebar__header">
          <span className="admin-sidebar__brand">Aurora CMS</span>
          <button
            className="admin-sidebar__toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>
        <nav>
          <ul className="admin-sidebar__nav">
            {NAV_ITEMS.map(({ label, path }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`
                  }
                >
                  <span className="admin-sidebar__label">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-topbar__menu-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <Notifications />
          <div className="admin-topbar__user-menu">
            <span className="admin-topbar__user-name">{userName}</span>
            <span className="admin-topbar__user-role">{userRole}</span>
            <button className="admin-topbar__logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
