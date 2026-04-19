import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';

interface DataSource {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  status: ConnectionStatus;
  lastTestedAt: string | null;
}

interface DataSourceFormData {
  name: string;
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

const EMPTY_FORM: DataSourceFormData = {
  name: '',
  type: 'oracle',
  host: '',
  port: '1521',
  database: '',
  username: '',
  password: '',
};

const STATUS_CLASS: Record<ConnectionStatus, string> = {
  connected: 'ds-badge ds-badge--connected',
  disconnected: 'ds-badge ds-badge--disconnected',
  unknown: 'ds-badge ds-badge--unknown',
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  unknown: 'Unknown',
};

export function DataSourceList() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DataSource | null>(null);
  const [form, setForm] = useState<DataSourceFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const data = await api.get<DataSource[]>('/data-sources');
      setSources(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load data sources');
    } finally {
      setLoading(false);
    }
  }

  async function testConnection(ds: DataSource) {
    if (testing.has(ds.id)) return;
    setTesting((prev) => new Set(prev).add(ds.id));
    try {
      const updated = await api.post<DataSource>(`/data-sources/${ds.id}/test`, {});
      setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : `Failed to test ${ds.name}`);
    } finally {
      setTesting((prev) => {
        const next = new Set(prev);
        next.delete(ds.id);
        return next;
      });
    }
  }

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(ds: DataSource) {
    setEditTarget(ds);
    setForm({
      name: ds.name,
      type: ds.type,
      host: ds.host,
      port: String(ds.port),
      database: ds.database,
      username: '',
      password: '',
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editTarget) {
        const updated = await api.put<DataSource>(`/data-sources/${editTarget.id}`, {
          ...form,
          port: Number(form.port),
        });
        setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await api.post<DataSource>('/data-sources', {
          ...form,
          port: Number(form.port),
        });
        setSources((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.detail : 'Failed to save data source');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ds: DataSource) {
    if (!confirm(`Delete data source "${ds.name}"?`)) return;
    try {
      await api.delete(`/data-sources/${ds.id}`);
      setSources((prev) => prev.filter((s) => s.id !== ds.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to delete data source');
    }
  }

  function handleField(field: keyof DataSourceFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) return <div className="ds-list__loading">Loading data sources…</div>;

  return (
    <div className="ds-list">
      <div className="ds-list__header">
        <h2 className="ds-list__title">Data Sources</h2>
        <button className="ds-list__add-btn" onClick={openCreate}>
          Add Data Source
        </button>
      </div>

      {error && (
        <div className="ds-list__error" role="alert">
          {error}
        </div>
      )}

      {sources.length === 0 ? (
        <div className="ds-list__empty">No data sources configured.</div>
      ) : (
        <table className="ds-list__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Host</th>
              <th>Status</th>
              <th>Last Tested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((ds) => (
              <tr key={ds.id} data-testid={`ds-row-${ds.id}`}>
                <td>
                  <strong>{ds.name}</strong>
                </td>
                <td>{ds.type}</td>
                <td>
                  {ds.host}:{ds.port}/{ds.database}
                </td>
                <td>
                  <span className={STATUS_CLASS[ds.status]}>{STATUS_LABEL[ds.status]}</span>
                </td>
                <td>{ds.lastTestedAt ? new Date(ds.lastTestedAt).toLocaleString() : '—'}</td>
                <td className="ds-list__actions">
                  <button
                    className="ds-list__test-btn"
                    onClick={() => void testConnection(ds)}
                    disabled={testing.has(ds.id)}
                    aria-label={`Test connection for ${ds.name}`}
                  >
                    {testing.has(ds.id) ? 'Testing…' : 'Test'}
                  </button>
                  <button
                    className="ds-list__edit-btn"
                    onClick={() => openEdit(ds)}
                    aria-label={`Edit ${ds.name}`}
                  >
                    Edit
                  </button>
                  <button
                    className="ds-list__delete-btn"
                    onClick={() => void handleDelete(ds)}
                    aria-label={`Delete ${ds.name}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="ds-form__overlay" role="dialog" aria-modal="true" aria-label="Data Source Form">
          <div className="ds-form">
            <h3 className="ds-form__title">
              {editTarget ? `Edit: ${editTarget.name}` : 'Add Data Source'}
            </h3>
            {formError && (
              <div className="ds-form__error" role="alert">
                {formError}
              </div>
            )}
            <form onSubmit={(e) => void handleSubmit(e)}>
              <label className="ds-form__label">
                Name
                <input
                  className="ds-form__input"
                  value={form.name}
                  onChange={(e) => handleField('name', e.target.value)}
                  required
                />
              </label>
              <label className="ds-form__label">
                Type
                <select
                  className="ds-form__select"
                  value={form.type}
                  onChange={(e) => handleField('type', e.target.value)}
                >
                  <option value="oracle">Oracle</option>
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="mssql">SQL Server</option>
                </select>
              </label>
              <label className="ds-form__label">
                Host
                <input
                  className="ds-form__input"
                  value={form.host}
                  onChange={(e) => handleField('host', e.target.value)}
                  required
                />
              </label>
              <label className="ds-form__label">
                Port
                <input
                  className="ds-form__input"
                  type="number"
                  value={form.port}
                  onChange={(e) => handleField('port', e.target.value)}
                  required
                />
              </label>
              <label className="ds-form__label">
                Database / Service Name
                <input
                  className="ds-form__input"
                  value={form.database}
                  onChange={(e) => handleField('database', e.target.value)}
                  required
                />
              </label>
              <label className="ds-form__label">
                Username
                <input
                  className="ds-form__input"
                  value={form.username}
                  onChange={(e) => handleField('username', e.target.value)}
                />
              </label>
              <label className="ds-form__label">
                Password
                <input
                  className="ds-form__input"
                  type="password"
                  value={form.password}
                  onChange={(e) => handleField('password', e.target.value)}
                  placeholder={editTarget ? '(leave blank to keep existing)' : ''}
                />
              </label>
              <div className="ds-form__actions">
                <button type="submit" className="ds-form__save-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="ds-form__cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
