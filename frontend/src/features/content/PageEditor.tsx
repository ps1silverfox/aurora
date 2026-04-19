import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import { AuroraEditor } from '../../editor/AuroraEditor';
import { type Block } from '../../editor/serializer';
import { RevisionSidebar } from './RevisionSidebar';
import type { PageStatus } from './PageList';

type WorkflowAction = 'submit' | 'approve' | 'publish' | 'archive';
type UserRole = 'editor' | 'approver' | 'publisher' | 'administrator';

interface PageDetail {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  authorId: string | null;
  scheduledAt: string | null;
  blocks: Block[];
  tags: string[];
  categories: string[];
  updatedAt: string;
}

// Maps (status, role) → available workflow actions
const WORKFLOW_ACTIONS: Record<PageStatus, Partial<Record<UserRole, WorkflowAction[]>>> = {
  draft: {
    editor: ['submit'],
    administrator: ['submit', 'publish', 'archive'],
  },
  review: {
    approver: ['approve', 'archive'],
    administrator: ['approve', 'archive'],
  },
  approved: {
    publisher: ['publish', 'archive'],
    administrator: ['publish', 'archive'],
  },
  published: {
    editor: ['archive'],
    approver: ['archive'],
    publisher: ['archive'],
    administrator: ['archive'],
  },
  archived: {},
};

const ACTION_LABEL: Record<WorkflowAction, string> = {
  submit: 'Submit for Review',
  approve: 'Approve',
  publish: 'Publish',
  archive: 'Archive',
};

const ACTION_CLASS: Record<WorkflowAction, string> = {
  submit: 'page-editor__action-btn page-editor__action-btn--submit',
  approve: 'page-editor__action-btn page-editor__action-btn--approve',
  publish: 'page-editor__action-btn page-editor__action-btn--publish',
  archive: 'page-editor__action-btn page-editor__action-btn--archive',
};

function getActions(status: PageStatus, role: UserRole): WorkflowAction[] {
  return WORKFLOW_ACTIONS[status]?.[role] ?? [];
}

interface PageEditorProps {
  userRole?: UserRole;
}

export function PageEditor({ userRole = 'editor' }: PageEditorProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new' || id === undefined;

  const [page, setPage] = useState<PageDetail | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [tags, setTags] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState<WorkflowAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      try {
        const data = await api.get<PageDetail>(`/pages/${id}`);
        setPage(data);
        setTitle(data.title);
        setSlug(data.slug);
        setScheduledAt(data.scheduledAt ? data.scheduledAt.slice(0, 16) : '');
        setTags(data.tags.join(', '));
        setBlocks(data.blocks);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Failed to load page');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  const handleSave = useCallback(async (currentBlocks: Block[]) => {
    setSaving(true);
    setError(null);
    const body = {
      title,
      slug: slug || undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      blocks: currentBlocks,
    };
    try {
      if (isNew) {
        const created = await api.post<PageDetail>('/pages', body);
        void navigate(`/pages/${created.id}`, { replace: true });
      } else {
        const updated = await api.patch<PageDetail>(`/pages/${id}`, body);
        setPage(updated);
        setBlocks(updated.blocks);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to save page');
    } finally {
      setSaving(false);
    }
  }, [id, isNew, navigate, slug, scheduledAt, title]);

  async function handleTransition(action: WorkflowAction) {
    if (!page) return;
    setTransitioning(action);
    setError(null);
    try {
      const updated = await api.post<PageDetail>(`/pages/${page.id}/transition`, { action });
      setPage(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : `Failed to ${action} page`);
    } finally {
      setTransitioning(null);
    }
  }

  function handleRevisionRestore(rev: { title: string; blocks: Block[] }) {
    setTitle(rev.title);
    setBlocks(rev.blocks);
    setShowRevisions(false);
  }

  if (loading) return <div className="page-editor__loading">Loading page…</div>;
  if (error && !page && !isNew) return <div className="page-editor__error" role="alert">{error}</div>;

  const workflowActions = page ? getActions(page.status, userRole) : [];

  return (
    <div className="page-editor">
      <div className="page-editor__toolbar">
        <button
          className="page-editor__back-btn"
          onClick={() => void navigate('/pages')}
        >
          ← Pages
        </button>

        <div className="page-editor__toolbar-right">
          {saved && <span className="page-editor__saved-notice" role="status">Saved</span>}
          {error && <span className="page-editor__error-notice" role="alert">{error}</span>}

          {workflowActions.map((action) => (
            <button
              key={action}
              className={ACTION_CLASS[action]}
              onClick={() => void handleTransition(action)}
              disabled={transitioning !== null}
              aria-label={ACTION_LABEL[action]}
            >
              {transitioning === action ? '…' : ACTION_LABEL[action]}
            </button>
          ))}

          {!isNew && (
            <button
              className="page-editor__revisions-btn"
              onClick={() => setShowRevisions((v) => !v)}
              aria-pressed={showRevisions}
            >
              Revisions
            </button>
          )}
        </div>
      </div>

      <div className="page-editor__body">
        <div className="page-editor__main">
          <input
            className="page-editor__title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
            aria-label="Page title"
          />

          <AuroraEditor
            key={page?.id ?? 'new'}
            initialBlocks={blocks}
            pageId={page?.id}
            onChange={setBlocks}
            onSave={handleSave}
          />
        </div>

        <aside className="page-editor__sidebar">
          {page && (
            <div className="page-editor__status-row">
              <span className={`page-badge page-badge--${page.status}`}>
                {page.status.charAt(0).toUpperCase() + page.status.slice(1)}
              </span>
            </div>
          )}

          <label className="page-editor__field">
            <span>Slug</span>
            <input
              className="page-editor__slug-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="auto-generated"
              aria-label="URL slug"
            />
          </label>

          <label className="page-editor__field">
            <span>Scheduled publish</span>
            <input
              className="page-editor__scheduled-input"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              aria-label="Scheduled publish date"
            />
          </label>

          <label className="page-editor__field">
            <span>Tags (comma-separated)</span>
            <input
              className="page-editor__tags-input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="news, featured"
              aria-label="Tags"
            />
          </label>

          <button
            className="page-editor__save-btn"
            onClick={() => void handleSave(blocks)}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </aside>

        {showRevisions && page && (
          <RevisionSidebar
            pageId={page.id}
            currentTitle={title}
            onRestore={handleRevisionRestore}
          />
        )}
      </div>
    </div>
  );
}
