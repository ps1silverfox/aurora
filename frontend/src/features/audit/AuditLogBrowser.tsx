import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../api/client';

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorEmail: string;
  diff: unknown;
  createdAt: string;
}

interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

interface Filters {
  entityType: string;
  actorEmail: string;
  dateFrom: string;
  dateTo: string;
}

const ENTITY_TYPES = ['', 'page', 'user', 'role', 'media', 'plugin', 'theme', 'setting'];

export function AuditLogBrowser() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({
    entityType: '',
    actorEmail: '',
    dateFrom: '',
    dateTo: '',
  });

  const abortRef = useRef<AbortController | null>(null);

  function buildQuery(cursor?: string) {
    const params = new URLSearchParams({ limit: '50' });
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.actorEmail) params.set('actorEmail', filters.actorEmail);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (cursor) params.set('cursor', cursor);
    return `/audit?${params.toString()}`;
  }

  async function loadEntries(cursor?: string) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<CursorPage<AuditEntry>>(buildQuery(cursor));
      setEntries((prev) => (cursor ? [...prev, ...result.data] : result.data));
      setNextCursor(result.nextCursor);
    } catch (err) {
      if (err instanceof ApiError) setError(err.detail);
      else if ((err as Error).name !== 'AbortError') setError('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleFilterChange(field: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="audit-browser">
      <h2 className="audit-browser__title">Audit Log</h2>

      <div className="audit-browser__filters">
        <select
          aria-label="Entity type"
          value={filters.entityType}
          onChange={(e) => handleFilterChange('entityType', e.target.value)}
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t || 'All types'}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by actor email"
          value={filters.actorEmail}
          aria-label="Actor email"
          onChange={(e) => handleFilterChange('actorEmail', e.target.value)}
        />

        <input
          type="date"
          aria-label="Date from"
          value={filters.dateFrom}
          onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
        />

        <input
          type="date"
          aria-label="Date to"
          value={filters.dateTo}
          onChange={(e) => handleFilterChange('dateTo', e.target.value)}
        />
      </div>

      {error && (
        <div className="audit-browser__error" role="alert">
          {error}
        </div>
      )}

      {entries.length === 0 && !loading ? (
        <div className="audit-browser__empty">No audit entries found.</div>
      ) : (
        <table className="audit-browser__table">
          <thead>
            <tr>
              <th />
              <th>Time</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Actor</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr>
                  <td>
                    <button
                      className="audit-browser__expand-btn"
                      aria-label={expanded.has(entry.id) ? 'Collapse diff' : 'Expand diff'}
                      onClick={() => toggleExpand(entry.id)}
                    >
                      {expanded.has(entry.id) ? '▲' : '▼'}
                    </button>
                  </td>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                  <td>
                    {entry.entityType}/{entry.entityId}
                  </td>
                  <td>{entry.action}</td>
                  <td>{entry.actorEmail}</td>
                </tr>
                {expanded.has(entry.id) && (
                  <tr className="audit-browser__diff-row">
                    <td colSpan={5}>
                      <pre className="audit-browser__diff">
                        {JSON.stringify(entry.diff, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {loading && <div className="audit-browser__loading">Loading…</div>}

      {nextCursor && !loading && (
        <button
          className="audit-browser__load-more"
          onClick={() => void loadEntries(nextCursor)}
        >
          Load more
        </button>
      )}
    </div>
  );
}
