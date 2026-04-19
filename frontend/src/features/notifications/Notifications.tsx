import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../api/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 30_000;

export function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.isRead).length;

  const load = async () => {
    try {
      const data = await api.get<Notification[]>('/notifications');
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load notifications');
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(() => { void load(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // best-effort
    }
  };

  return (
    <div className="notifications" ref={panelRef}>
      <button
        className={`notifications__bell${unread > 0 ? ' notifications__bell--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
      >
        <span aria-hidden="true">&#x1F514;</span>
        {unread > 0 && <span className="notifications__badge">{unread}</span>}
      </button>

      {open && (
        <div className="notifications__panel" role="dialog" aria-label="Notifications">
          <div className="notifications__header">
            <h3>Notifications</h3>
            <span className="notifications__count">{unread} unread</span>
          </div>

          {error && <p className="notifications__error">{error}</p>}

          {items.length === 0 && !error && (
            <p className="notifications__empty">No notifications</p>
          )}

          <ul className="notifications__list">
            {items.map((n) => (
              <li
                key={n.id}
                className={`notifications__item${n.isRead ? '' : ' notifications__item--unread'}`}
              >
                <div className="notifications__item-content">
                  <span className="notifications__item-title">{n.title}</span>
                  {n.body && <span className="notifications__item-body">{n.body}</span>}
                  <time className="notifications__item-time" dateTime={n.createdAt}>
                    {new Date(n.createdAt).toLocaleString()}
                  </time>
                </div>
                {!n.isRead && (
                  <button
                    className="notifications__mark-read"
                    onClick={() => void markRead(n.id)}
                    aria-label="Mark as read"
                  >
                    &#x2713;
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
