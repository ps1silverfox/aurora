import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

interface PluginSettingSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  defaultValue?: unknown;
}

interface PluginManifest {
  name: string;
  version: string;
  entrypoint: string;
  permissions: string[];
  hooks: string[];
  blocks: string[];
  routes: string[];
  settings: PluginSettingSchema[];
}

export type PluginStatus = 'inactive' | 'active' | 'error';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  status: PluginStatus;
  manifest: PluginManifest;
  installedAt: string;
  activatedAt: string | null;
}

const STATUS_LABEL: Record<PluginStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  error: 'Error',
};

const STATUS_CLASS: Record<PluginStatus, string> = {
  active: 'plugin-badge plugin-badge--active',
  inactive: 'plugin-badge plugin-badge--inactive',
  error: 'plugin-badge plugin-badge--error',
};

export function PluginList() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<Plugin[]>('/plugins');
        setPlugins(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load plugins');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function toggle(plugin: Plugin) {
    if (toggling.has(plugin.id)) return;
    const isActive = plugin.status === 'active';
    const endpoint = isActive ? `/plugins/${plugin.id}/deactivate` : `/plugins/${plugin.id}/activate`;

    // Optimistic update
    setPlugins((prev) =>
      prev.map((p) =>
        p.id === plugin.id ? { ...p, status: isActive ? 'inactive' : 'active' } : p,
      ),
    );
    setToggling((prev) => new Set(prev).add(plugin.id));

    try {
      const updated = await api.post<Plugin>(endpoint, {});
      setPlugins((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      // Rollback on failure
      setPlugins((prev) => prev.map((p) => (p.id === plugin.id ? plugin : p)));
      setError(err instanceof ApiError ? err.detail : `Failed to ${isActive ? 'deactivate' : 'activate'} plugin`);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(plugin.id);
        return next;
      });
    }
  }

  if (loading) return <div className="plugin-list__loading">Loading plugins…</div>;
  if (error) return <div className="plugin-list__error" role="alert">{error}</div>;
  if (plugins.length === 0) return <div className="plugin-list__empty">No plugins installed.</div>;

  return (
    <div className="plugin-list">
      <h2 className="plugin-list__title">Installed Plugins</h2>
      <table className="plugin-list__table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Version</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {plugins.map((plugin) => (
            <tr key={plugin.id} data-testid={`plugin-row-${plugin.id}`}>
              <td>
                <strong>{plugin.name}</strong>
              </td>
              <td>{plugin.version}</td>
              <td>
                <span className={STATUS_CLASS[plugin.status]}>
                  {STATUS_LABEL[plugin.status]}
                </span>
              </td>
              <td className="plugin-list__actions">
                <button
                  className="plugin-list__toggle"
                  onClick={() => void toggle(plugin)}
                  disabled={toggling.has(plugin.id) || plugin.status === 'error'}
                  aria-label={plugin.status === 'active' ? `Deactivate ${plugin.name}` : `Activate ${plugin.name}`}
                >
                  {toggling.has(plugin.id)
                    ? '…'
                    : plugin.status === 'active'
                      ? 'Deactivate'
                      : 'Activate'}
                </button>
                {plugin.manifest.settings.length > 0 && (
                  <Link
                    to={`/plugins/${plugin.id}/settings`}
                    className="plugin-list__settings-link"
                    aria-label={`Settings for ${plugin.name}`}
                  >
                    Settings
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
