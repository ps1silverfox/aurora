import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

const ALL_PERMISSIONS = [
  'pages:read',
  'pages:create',
  'pages:edit',
  'pages:delete',
  'pages:publish',
  'media:read',
  'media:upload',
  'media:delete',
  'users:read',
  'users:edit',
  'plugins:read',
  'plugins:manage',
  'themes:read',
  'themes:manage',
  'audit:read',
  'settings:manage',
] as const;

type Permission = (typeof ALL_PERMISSIONS)[number];

export function RoleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [name, setName] = useState('');
  const [perms, setPerms] = useState<Set<Permission>>(new Set());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      try {
        const role = await api.get<Role>(`/roles/${id}`);
        setName(role.name);
        setPerms(new Set(role.permissions as Permission[]));
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load role');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  function togglePerm(perm: Permission) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await api.post('/roles', { name, permissions: [...perms] });
      } else {
        await api.put(`/roles/${id}`, { name, permissions: [...perms] });
      }
      void navigate('/users');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="role-editor__loading">Loading role…</div>;

  return (
    <div className="role-editor">
      <h2 className="role-editor__title">{isNew ? 'New Role' : 'Edit Role'}</h2>
      {error && (
        <div className="role-editor__error" role="alert">
          {error}
        </div>
      )}
      <form className="role-editor__form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="role-editor__field">
          <label htmlFor="role-name">Role name</label>
          <input
            id="role-name"
            type="text"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <fieldset className="role-editor__permissions">
          <legend>Permissions</legend>
          {ALL_PERMISSIONS.map((perm) => (
            <label key={perm} className="role-editor__perm-label">
              <input
                type="checkbox"
                checked={perms.has(perm)}
                onChange={() => togglePerm(perm)}
              />
              {perm}
            </label>
          ))}
        </fieldset>

        <div className="role-editor__actions">
          <button
            type="button"
            className="role-editor__cancel-btn"
            onClick={() => void navigate('/users')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="role-editor__save-btn"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Role'}
          </button>
        </div>
      </form>
    </div>
  );
}
