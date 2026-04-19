import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

export type UserRole = 'admin' | 'editor' | 'author' | 'viewer';

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  author: 'Author',
  viewer: 'Viewer',
};

const ROLE_CLASS: Record<UserRole, string> = {
  admin: 'user-badge user-badge--admin',
  editor: 'user-badge user-badge--editor',
  author: 'user-badge user-badge--author',
  viewer: 'user-badge user-badge--viewer',
};

const ALL_ROLES: UserRole[] = ['admin', 'editor', 'author', 'viewer'];

export function UserList() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<UserSummary[]>('/users');
        setUsers(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    const prev = users.find((u) => u.id === userId)?.role;
    if (!prev || prev === newRole) return;

    setChanging((s) => new Set(s).add(userId));
    setUsers((list) =>
      list.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
    );

    try {
      await api.patch(`/users/${userId}`, { role: newRole });
    } catch (err) {
      // roll back on failure
      setUsers((list) =>
        list.map((u) => (u.id === userId ? { ...u, role: prev } : u)),
      );
      setError(err instanceof ApiError ? err.detail : 'Failed to update role');
    } finally {
      setChanging((s) => {
        const next = new Set(s);
        next.delete(userId);
        return next;
      });
    }
  }

  if (loading) return <div className="user-list__loading">Loading users…</div>;
  if (error) return <div className="user-list__error" role="alert">{error}</div>;

  return (
    <div className="user-list">
      <div className="user-list__header">
        <h2 className="user-list__title">Users</h2>
        <Link to="/roles/new" className="user-list__new-role-btn">
          New Role
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="user-list__empty">No users found.</div>
      ) : (
        <table className="user-list__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.displayName}</td>
                <td>{user.email}</td>
                <td>
                  <span className={ROLE_CLASS[user.role]}>
                    {ROLE_LABEL[user.role]}
                  </span>
                  <select
                    className="user-list__role-select"
                    value={user.role}
                    disabled={changing.has(user.id)}
                    aria-label={`Change role for ${user.displayName}`}
                    onChange={(e) =>
                      void handleRoleChange(user.id, e.target.value as UserRole)
                    }
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{user.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
