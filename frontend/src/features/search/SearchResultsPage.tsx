import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  score: number;
  publishedAt: string | null;
}

interface SearchPage {
  data: SearchResult[];
  nextCursor: string | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'archived', label: 'Archived' },
];

function buildSearchUrl(q: string, status: string, cursor?: string): string {
  const params = new URLSearchParams({ q });
  if (status) params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', '20');
  return `/search?${params.toString()}`;
}

// Naive snippet: highlights query terms in title with <mark>
function highlightTerms(text: string, query: string): React.ReactNode[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (terms.length === 0) return [text];
  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ background: '#fff3b0', padding: 0 }}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? '';

  const [inputValue, setInputValue] = useState(q);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadPage = useCallback(
    async (query: string, statusFilter: string, cursor?: string) => {
      if (!query.trim()) {
        setResults([]);
        setNextCursor(null);
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const isLoadMore = cursor != null;
      if (isLoadMore) setLoadingMore(true);
      else { setLoading(true); setResults([]); }
      setError(null);

      try {
        const params = new URLSearchParams({ q: query.trim(), limit: '20' });
        if (statusFilter) params.set('status', statusFilter);
        if (cursor) params.set('cursor', cursor);
        const page = await api.get<SearchPage>(`/search?${params.toString()}`);
        if (isLoadMore) {
          setResults((prev) => [...prev, ...page.data]);
        } else {
          setResults(page.data);
        }
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (err instanceof ApiError) setError(err.detail);
        else setError('Search failed. Please try again.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Re-fetch when URL params change
  useEffect(() => {
    setInputValue(q);
    void loadPage(q, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      setSearchParams({ q: trimmed, ...(status ? { status } : {}) });
    },
    [inputValue, status, setSearchParams],
  );

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      setSearchParams({ q, ...(newStatus ? { status: newStatus } : {}) });
    },
    [q, setSearchParams],
  );

  const handleLoadMore = useCallback(() => {
    if (nextCursor) void loadPage(q, status, nextCursor);
  }, [q, status, nextCursor, loadPage]);

  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 1100, margin: '32px auto', padding: '0 16px' }}>
      {/* Filter sidebar */}
      <aside style={{ width: 180, flexShrink: 0 }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#666', marginBottom: 12 }}>
          Status
        </h3>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {STATUS_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                onClick={() => handleStatusChange(opt.value)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 14,
                  background: status === opt.value ? '#e8efff' : 'transparent',
                  color: status === opt.value ? '#2a5bd7' : '#333',
                  fontWeight: status === opt.value ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main results */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input
            type="search"
            aria-label="Search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', fontSize: 16, border: '1px solid #ccc', borderRadius: 6 }}
            placeholder="Search content…"
          />
          <button
            type="submit"
            style={{ padding: '8px 20px', background: '#2a5bd7', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            Search
          </button>
        </form>

        {/* Results count / heading */}
        {q && !loading && (
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            {results.length > 0
              ? `${results.length}${nextCursor ? '+' : ''} result${results.length !== 1 ? 's' : ''} for `
              : 'No results for '}
            <strong>"{q}"</strong>
            {status ? ` in ${status}` : ''}
          </p>
        )}

        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>Searching…</div>
        )}

        {error && (
          <div role="alert" style={{ padding: 12, background: '#fff0f0', border: '1px solid #fcc', borderRadius: 4, color: '#c00', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!loading && results.length === 0 && q && !error && (
          <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>
            No pages found for "{q}".
          </div>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {results.map((item) => (
            <li
              key={item.id}
              style={{
                padding: '16px 0',
                borderBottom: '1px solid #eee',
              }}
            >
              <button
                onClick={() => navigate(`/${item.slug}`)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                <h2 style={{ margin: 0, fontSize: 18, color: '#1a3a7c' }}>
                  {highlightTerms(item.title, q)}
                </h2>
              </button>
              <div style={{ marginTop: 4, fontSize: 13, color: '#666', display: 'flex', gap: 16 }}>
                <span>/{item.slug}</span>
                {item.publishedAt && (
                  <span>Published {new Date(item.publishedAt).toLocaleDateString()}</span>
                )}
                <span style={{ color: '#aaa' }}>score: {item.score}</span>
              </div>
            </li>
          ))}
        </ul>

        {nextCursor && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                padding: '10px 28px',
                border: '1px solid #ccc',
                borderRadius: 6,
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                fontSize: 14,
                background: '#fff',
                color: '#333',
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more results'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
