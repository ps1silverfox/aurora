import { RouteObject } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { Dashboard } from '../features/dashboard/Dashboard';
import { PluginList } from '../features/plugins/PluginList';
import { PluginSettings } from '../features/plugins/PluginSettings';
import { PageList } from '../features/content/PageList';
import { PageEditor } from '../features/content/PageEditor';
import { UserList } from '../features/users/UserList';
import { RoleEditor } from '../features/users/RoleEditor';
import { AuditLogBrowser } from '../features/audit/AuditLogBrowser';

function Placeholder({ label }: { label: string }) {
  return <div className="placeholder">{label} — coming soon</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'pages', element: <PageList /> },
      { path: 'pages/:id', element: <PageEditor /> },
      { path: 'media', element: <Placeholder label="Media" /> },
      { path: 'data-sources', element: <Placeholder label="Data Sources" /> },
      { path: 'plugins', element: <PluginList /> },
      { path: 'plugins/:id/settings', element: <PluginSettings /> },
      { path: 'themes', element: <Placeholder label="Themes" /> },
      { path: 'users', element: <UserList /> },
      { path: 'roles/new', element: <RoleEditor /> },
      { path: 'roles/:id', element: <RoleEditor /> },
      { path: 'audit-log', element: <AuditLogBrowser /> },
      { path: 'settings', element: <Placeholder label="Settings" /> },
      { path: '*', element: <Placeholder label="404 — Page Not Found" /> },
    ],
  },
];
