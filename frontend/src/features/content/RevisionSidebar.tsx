import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

interface BlockInput {
  type: string;
  data: Record<string, unknown>;
  order: number;
}

interface Revision {
  id: string;
  pageId: string;
  title: string;
  blocks: BlockInput[];
  createdBy: string | null;
  createdAt: string;
}

interface RevisionSidebarProps {
  pageId: string;
  currentTitle: string;
  onRestore: (revision: Revision) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RevisionSidebar({ pageId, currentTitle, onRestore }: RevisionSidebarProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<Revision[]>(`/pages/${pageId}/revisions`);
        setRevisions(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load revisions');
      } finally {
        setLoading(false);
      }
    })();
  }, [pageId]);

  async function handleRestore(revision: Revision) {
    if (!confirm(`Restore to revision from ${formatDate(revision.createdAt)}?`)) return;
    setRestoringId(revision.id);
    try {
      await api.post(`/pages/${pageId}/revisions/${revision.id}/restore`, {});
      onRestore(revision);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to restore revision');
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) return <div className="revision-sidebar__loading">Loading revisions…</div>;
  if (error) return <div className="revision-sidebar__error" role="alert">{error}</div>;

  return (
    <div className="revision-sidebar">
      <h3 className="revision-sidebar__title">Revision History</h3>

      {revisions.length === 0 ? (
        <p className="revision-sidebar__empty">No revisions yet.</p>
      ) : (
        <ul className="revision-sidebar__list">
          {revisions.map((rev) => (
            <li
              key={rev.id}
              className="revision-sidebar__item"
              data-testid={`revision-${rev.id}`}
            >
              <div className="revision-sidebar__meta">
                <span className="revision-sidebar__date">{formatDate(rev.createdAt)}</span>
                {rev.createdBy && (
                  <span className="revision-sidebar__author">by {rev.createdBy}</span>
                )}
              </div>

              <div className="revision-sidebar__item-actions">
                <button
                  className="revision-sidebar__diff-btn"
                  onClick={() => setExpandedId((prev) => (prev === rev.id ? null : rev.id))}
                  aria-expanded={expandedId === rev.id}
                >
                  {expandedId === rev.id ? 'Hide diff' : 'View diff'}
                </button>
                <button
                  className="revision-sidebar__restore-btn"
                  onClick={() => void handleRestore(rev)}
                  disabled={restoringId === rev.id}
                  aria-label={`Restore revision from ${formatDate(rev.createdAt)}`}
                >
                  {restoringId === rev.id ? '…' : 'Restore'}
                </button>
              </div>

              {expandedId === rev.id && (
                <div className="revision-sidebar__diff" aria-label="Revision diff">
                  <div className="revision-sidebar__diff-title">
                    <span className="revision-sidebar__diff-removed">− {currentTitle}</span>
                    <span className="revision-sidebar__diff-added">+ {rev.title}</span>
                  </div>
                  <pre className="revision-sidebar__diff-blocks">
                    {JSON.stringify(rev.blocks, null, 2)}
                  </pre>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
