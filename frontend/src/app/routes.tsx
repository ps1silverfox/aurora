import { RouteObject } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { Dashboard } from '../features/dashboard/Dashboard';
import { PluginList } from '../features/plugins/PluginList';
import { PluginSettings } from '../features/plugins/PluginSettings';

function Placeholder({ label }: { label: string }) {
  return <div className="placeholder">{label} — coming soon</div>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'pages', element: <Placeholder label="Pages" /> },
      { path: 'media', element: <Placeholder label="Media" /> },
      { path: 'data-sources', element: <Placeholder label="Data Sources" /> },
      { path: 'plugins', element: <PluginList /> },
      { path: 'plugins/:id/settings', element: <PluginSettings /> },
      { path: 'themes', element: <Placeholder label="Themes" /> },
      { path: 'users', element: <Placeholder label="Users" /> },
      { path: 'audit-log', element: <Placeholder label="Audit Log" /> },
      { path: 'settings', element: <Placeholder label="Settings" /> },
      { path: '*', element: <Placeholder label="404 — Page Not Found" /> },
    ],
  },
];
