import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

export type PageStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';

export interface PageSummary {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  authorId: string | null;
  updatedAt: string;
  publishedAt: string | null;
}

interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

const STATUS_LABEL: Record<PageStatus, string> = {
  draft: 'Draft',
  review: 'In Review',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
};

const STATUS_CLASS: Record<PageStatus, string> = {
  draft: 'page-badge page-badge--draft',
  review: 'page-badge page-badge--review',
  approved: 'page-badge page-badge--approved',
  published: 'page-badge page-badge--published',
  archived: 'page-badge page-badge--archived',
};

export function PageList() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      try {
        const result = await api.get<CursorPage<PageSummary>>('/pages?limit=50');
        setPages(result.data);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load pages');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleDelete(page: PageSummary) {
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    setDeletingId(page.id);
    try {
      await api.delete(`/pages/${page.id}`);
      setPages((prev) => prev.filter((p) => p.id !== page.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to delete page');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="page-list__loading">Loading pages…</div>;
  if (error) return <div className="page-list__error" role="alert">{error}</div>;

  return (
    <div className="page-list">
      <div className="page-list__header">
        <h2 className="page-list__title">Pages</h2>
        <button
          className="page-list__new-btn"
          onClick={() => void navigate('/pages/new')}
        >
          New Page
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="page-list__empty">No pages yet. Create your first page.</div>
      ) : (
        <table className="page-list__table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Author</th>
              <th>Last Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} data-testid={`page-row-${page.id}`}>
                <td>
                  <Link to={`/pages/${page.id}`} className="page-list__title-link">
                    {page.title}
                  </Link>
                  <span className="page-list__slug">/{page.slug}</span>
                </td>
                <td>
                  <span className={STATUS_CLASS[page.status]}>
                    {STATUS_LABEL[page.status]}
                  </span>
                </td>
                <td>{page.authorId ?? '—'}</td>
                <td>{new Date(page.updatedAt).toLocaleDateString()}</td>
                <td className="page-list__actions">
                  <Link
                    to={`/pages/${page.id}`}
                    className="page-list__edit-btn"
                    aria-label={`Edit ${page.title}`}
                  >
                    Edit
                  </Link>
                  <button
                    className="page-list__delete-btn"
                    onClick={() => void handleDelete(page)}
                    disabled={deletingId === page.id}
                    aria-label={`Delete ${page.title}`}
                  >
                    {deletingId === page.id ? '…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
